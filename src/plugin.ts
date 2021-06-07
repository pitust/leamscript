import { readdirSync, statSync } from 'fs'
import { join } from 'path'
import {
    Pass,
    Type,
    CompilationResult,
    attr,
    validate,
    compile,
    factoryType,
    expect
} from './index'
import { Argument, Node } from './parser'

interface Plugin {
    [k: string]: (p: Pass, args: Node[]) => Node | CompilationResult | Type
}

export let plugins = new Map<
    string,
    {
        p: Plugin
        $hooks?: Record<string, (p: Pass, n: Node) => Generator<undefined, void, unknown>>
    }
>()
function loadPlugin(id: string, path: string) {
    if (path.endsWith('.d.ts')) return
    let tgd = require(join(process.cwd(), path))
    plugins.set(id, { p: <Plugin>tgd, $hooks: tgd.$hooks })
}

function scanDir(id: string[], path: string) {
    for (let e of readdirSync(path)) {
        if (statSync(path + '/' + e).isDirectory()) scanDir([...id, e], path + '/' + e)
        else loadPlugin([...id, e.split('.')[0]].join('.'), path + '/' + e)
    }
}

export function plugcheck(
    callnode: Node,
    callee: Node,
    args: Node[],
    p: Pass
): CompilationResult | null {
    let n2 = callee
    let o: string[] = []
    while (n2.id == 'MemberAccess') {
        o.push(attr(n2, 'member'))
        n2 = n2.children[0]
    }
    if (n2.id == 'Variable') {
        o.push(attr(n2, 'name'))
        let target = o.reverse().slice(0, -1).join('.')
        let tmethod = o.slice(-1)[0]
        if (target.startsWith('nplugin.')) {
            let tgd = validate(
                validate(
                    plugins.get(target.slice(8)),
                    'Unknown plugin ' + target.slice(8)
                ).p[tmethod],
                'Unknown method ' + tmethod
            )
            let ve = tgd(p, args)
            if ('args' in ve) {
                return compile(ve, p, false)
            }
            if ('code' in ve) {
                return ve
            }
            validate(p == Pass.PassValueTypePropagation, 'Invalid plugin response')
            let vex = ve
            callnode.args.push(Argument('typeid', factoryType(_ => vex).name))
            return CompilationResult()
        }
    }
    return null
}

export function wrap<T extends (...args: U) => V, U extends any[], V>(
    target: T,
    getGeneratorFunctiions: (...args: Parameters<T>) => ((
        c: [V | null, (r: V) => void],
        ...a: Parameters<T>
    ) => Generator)[]
): (...args: U) => V {
    return <any>((...args: Parameters<T>): V => {
        let getter: [null | V, (r: V) => void] = [null, z => void (expect(getter, 'ICE')[0] = z)]
        let generators = getGeneratorFunctiions(...args).map(targetFn => targetFn(getter, ...args))
        generators.forEach(e => e.next())
        getter[0] = target(...args)
        generators.forEach(e => e.next())
        return getter[0]
    })
}

export function init() {
    scanDir([], 'plugin')
}
