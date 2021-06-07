import { createHash } from 'crypto'
import { wrap } from './plugin'
import { Node, Argument, parseResult } from './parser'
import { init, plugcheck, plugins } from './plugin'

export enum Pass {
    PassPrevalidate,
    PassFunctionTypePropagation,
    PassValueTypePropagation,
    PassCompile,
    PassPreCompile
}

export interface CompilationResult {
    result: string
    code: string
}
export function CompilationResult(
    result: string = '',
    code: string = ''
): CompilationResult {
    return { result, code }
}
export function Append(r: CompilationResult, r2: CompilationResult): string {
    r.code = r.code + r2.code
    return r2.result
}
export function AppendFull(r: CompilationResult, r2: CompilationResult) {
    r.code = r.code + r2.code + r2.result
}

export function abort(e: string): never {
    console.trace(e)
    process.exit(2)
}

export interface Type {
    name: string
    cTypeName: string
    genericApply(args: Type[]): Type
    hasMember(s: string): boolean
    getMemberGetterName(s: string): string
    memberType(s: string): Type
    opCall(isMemberCall: boolean, a: Type[]): Type
}

export const typeRegistry = new Map<string, Type>()

export function factoryType(t: (t: Type) => Type): Type {
    let o: Type = {} as Type
    Object.assign(o, t(o))
    typeRegistry.set(o.name, o)
    return o
}

export const getNumberAdder: (t: Type) => Type = other =>
    factoryType(self => ({
        name: '#intadd#' + other.name,
        cTypeName: '__runtimeAddInt(' + other.cTypeName + ')',
        genericApply() {
            abort('ICE: invariant violated')
        },
        hasMember() {
            return false
        },
        getMemberGetterName() {
            abort('ICE: invariant violated')
        },
        memberType() {
            abort('ICE: invariant violated')
        },
        opCall() {
            return other
        }
    }))

// The number type
export const internalNumberType: Type = factoryType(self => ({
    name: 'internal.NumberType',
    cTypeName: '#invalid#',
    genericApply(args: Type[]): Type {
        if (args.length !== 1) abort('internal invariant violated')
        return (
            typeRegistry.get('internal.NumberType<' + args[0].name + '>') ??
                typeRegistry.set('internal.NumberType<' + args[0].name + '>', {
                    name: 'internal.NumberType<' + args[0].name + '>',
                    cTypeName: args[0].cTypeName,
                    hasMember(s) {
                        if (s == /* opAdd(number) */ `opAdd$12886f9d`) {
                            return true
                        }
                        abort('internal invariant violated')
                    },
                    getMemberGetterName(s) {
                        abort('internal invariant violated')
                    },
                    memberType(s) {
                        return getNumberAdder(args[0])
                    },
                    genericApply(args) {
                        abort('internal invariant violated')
                    },
                    opCall(a) {
                        abort('internal invariant violated')
                    }
                }),
            typeRegistry.get('internal.NumberType<' + args[0].name + '>')!
        )
    },
    hasMember(s: string) {
        abort('internal invariant violated')
    },
    getMemberGetterName(s: string) {
        abort('internal invariant violated')
    },
    memberType(s) {
        abort('internal invariant violated')
    },
    opCall() {
        abort('internal invariant violated')
    }
}))

// The number type
export const number: Type = factoryType(number => ({
    name: 'number',
    cTypeName: 'float',
    genericApply(args: Type[]): Type {
        abort('Compiler error: invalid generic apply over `number`')
    },
    hasMember(s: string) {
        return (
            typeRegistry.has('internal.NumberType') &&
            typeRegistry.get('internal.NumberType')!.genericApply([number]).hasMember(s)
        )
    },
    memberType(s) {
        return typeRegistry
            .get('internal.NumberType')!
            .genericApply([number])
            .memberType(s)
    },
    getMemberGetterName(s: string) {
        return typeRegistry
            .get('internal.NumberType')!
            .genericApply([number])
            .getMemberGetterName(s)
    },
    opCall() {
        abort('Cannot call number')
    }
}))

// The string type
export const string: Type = factoryType(number => ({
    name: 'string',
    cTypeName: 'const char*',
    genericApply(args: Type[]): Type {
        abort('Compiler error: invalid generic apply over `string`')
    },
    hasMember(s: string) {
        return (
            typeRegistry.has('internal.StringType') &&
            typeRegistry.get('internal.StringType')!.hasMember(s)
        )
    },
    memberType(s) {
        return typeRegistry.get('internal.StringType')!.memberType(s)
    },
    getMemberGetterName(s: string) {
        return typeRegistry.get('internal.StringType')!.getMemberGetterName(s)
    },
    opCall() {
        abort('Cannot call string')
    }
}))

// The void type
export const voidty: Type = factoryType(number => ({
    name: 'void',
    cTypeName: 'void',
    genericApply(args: Type[]): Type {
        abort('Compiler error: invalid generic apply over `void`')
    },
    hasMember(s: string) {
        return false
    },
    memberType(s) {
        abort('ICE: WTF?')
    },
    getMemberGetterName(s: string) {
        abort('ICE: WTF?')
    },
    opCall() {
        abort('ICE: WTF?')
    }
}))

// The C `int` type
export const int: Type = factoryType(number => ({
    name: 'C.int',
    cTypeName: 'int',
    genericApply(args: Type[]): Type {
        abort('Compiler error: invalid generic apply over `C.int`')
    },
    hasMember(s: string) {
        return (
            typeRegistry.has('internal.NumberType') &&
            typeRegistry.get('internal.NumberType')!.genericApply([number]).hasMember(s)
        )
    },
    getMemberGetterName(s: string) {
        return typeRegistry
            .get('internal.NumberType')!
            .genericApply([number])
            .getMemberGetterName(s)
    },
    memberType(s) {
        return typeRegistry
            .get('internal.NumberType')!
            .genericApply([number])
            .memberType(s)
    },
    opCall() {
        abort('Cannot call C.int')
    }
}))

export function attr(t: Node, n: string) {
    let p = attrs(t, n)
    if (p.length != 1) abort('Invalid attr ' + n + ' on ' + t.id)
    return p[0]
}
export function attrs(t: Node, n: string) {
    return t.args.filter(e => e.typeHint == n).map(e => e.argument)
}
export function child(t: Node, n: string) {
    let p = children(t, n)
    if (p.length != 1)
        abort('Invalid childid ' + n + ' on ' + t.id + ' (has ' + p.length + ' expect 1)')
    return p[0]
}
export function haschild(t: Node, n: string) {
    let p = children(t, n)
    if (p.length > 1)
        abort(
            'Invalid childid ' +
                n +
                ' on ' +
                t.id +
                ' (has ' +
                p.length +
                ' expect 0 or 1)'
        )
    return !!p.length
}
export function children(t: Node, n: string) {
    return t.children.filter(e => e.id == n)
}

export function expect<T>(t: T | null | undefined, msg: string): T {
    if (!t) abort('ICE: ' + msg)
    return t
}

export function validate<T>(t: T | null | undefined, msg: string): T {
    if (!t) abort('Error: ' + msg)
    return t
}

interface Context {
    returnType: /* typeid */ string
    locals: Map<string, /* typeid */ string>
}

export function createContextManager<T>() {
    let i: T | null = null
    return {
        pushctx(newctx: T) {
            let o = i
            i = newctx
            return () => {
                i = o
            }
        },
        ctx() {
            return expect(i, 'No context yet')
        }
    }
}
let { pushctx, ctx } = createContextManager<Context>()

typeRegistry.set('number', number)
typeRegistry.set('void', voidty)
typeRegistry.set('C.int', int)
typeRegistry.set('internal.NumberType', internalNumberType)

export const compile = wrap<
    (n: Node, p: Pass, istoplevel?: boolean) => CompilationResult,
    [Node, Pass, boolean?],
    CompilationResult
>(
    function (n: Node, p: Pass, istoplevel: boolean = false): CompilationResult {
        // PassPrevalidate
        if (p == Pass.PassPrevalidate && n.id == 'Function' && !istoplevel) {
            abort('Error: Function nesting is not allowed!')
        }
        if (p == Pass.PassPrevalidate && n.id == 'Function') {
            n.children.forEach(e => compile(e, p, false))
            return CompilationResult('', '')
        }
        if (p == Pass.PassPrevalidate) {
            n.children.forEach(e => compile(e, p, istoplevel))
            return CompilationResult('', '')
        }
        if (n.id == 'FunctionReturn' || n.id == 'FunctionArgument') {
            if (p == Pass.PassFunctionTypePropagation) {
                compile(n.children[0], p, istoplevel)
                n.args.push(Argument('typeid', attr(n.children[0], 'typeid')))
                return CompilationResult()
            }
        }
        if (n.id == 'TypeIdent') {
            n.args.push(Argument('typeid', attr(n, 'name')))
            return CompilationResult()
        }
        if (n.id == 'Function') {
            if (p == Pass.PassFunctionTypePropagation) {
                compile(
                    child(child(n, 'FunctionArguments'), 'FunctionReturn'),
                    p,
                    istoplevel
                )
                children(child(n, 'FunctionArguments'), 'FunctionArgument').forEach(e =>
                    compile(e, p, istoplevel)
                )
                let argmap = children(child(n, 'FunctionArguments'), 'FunctionArgument')
                    .map(e => attr(e, 'typeid'))
                    .join('|||$$#$$|||')
                typeRegistry.set('#func:' + attr(n, 'name'), {
                    name: '#func:' + attr(n, 'name'),
                    cTypeName: '__func_' + attr(n, 'name'),
                    hasMember() {
                        return false
                    },
                    genericApply() {
                        abort('Invalid generic on #func:' + attr(n, 'name'))
                    },
                    getMemberGetterName() {
                        abort(
                            'ICE: getMemberGetterName called on #func:' + attr(n, 'name')
                        )
                    },
                    memberType() {
                        abort('ICE: memberType called on #func:' + attr(n, 'name'))
                    },
                    opCall(isMemberCall, a: Type[]) {
                        if (isMemberCall) abort('Error: call type mismatch')
                        if (a.map(e => e.name).join('|||$$#$$|||') != argmap)
                            abort(
                                `Invalid call: ${attr(n, 'name')}(${a
                                    .map(e => e.name)
                                    .join(', ')})`
                            )
                        return expect(
                            typeRegistry.get(
                                attr(
                                    child(
                                        child(n, 'FunctionArguments'),
                                        'FunctionReturn'
                                    ),
                                    'typeid'
                                )
                            ),
                            'Function->FunctionReturn does not have a valid typeid'
                        )
                    }
                })
                n.args.push(Argument('typeid', '#func:' + attr(n, 'name')))
                return CompilationResult()
            }
            if (p == Pass.PassCompile) {
                return CompilationResult(
                    `${
                        typeRegistry.get(
                            attr(
                                child(child(n, 'FunctionArguments'), 'FunctionReturn'),
                                'typeid'
                            )
                        )!.cTypeName
                    } __func_${attr(n, 'name')}(${children(
                        child(n, 'FunctionArguments'),
                        'FunctionArgument'
                    ).map(
                        e =>
                            expect(
                                typeRegistry.get(attr(e, 'typeid')),
                                "Function:FunctionArguments:FunctionArgument does not have a vaild typeid (it'ss " +
                                    attr(e, 'typeid') +
                                    ')'
                            ).cTypeName + ` ${attr(e, 'name')}`
                    )}) {
                    ${compile(Node('RAIIBegin', [], []), p, false).code}
                    ${compile(n.children[1], p, false).code}
                    ${
                        typeRegistry.get(
                            attr(
                                child(child(n, 'FunctionArguments'), 'FunctionReturn'),
                                'typeid'
                            )
                        )!.cTypeName == 'void'
                            ? `${compile(Node('RAIIEnd', [], []), p, false).code} return;`
                            : `/* (${
                                  typeRegistry.get(
                                      attr(
                                          child(
                                              child(n, 'FunctionArguments'),
                                              'FunctionReturn'
                                          ),
                                          'typeid'
                                      )
                                  )!.cTypeName
                              }) todo: maybe this could be a call to an intrinsic, eg. internal.trap? */ __builtin_trap();`
                    }
                }`,
                    ''
                )
            }
            if (p == Pass.PassPreCompile) {
                return CompilationResult(
                    `${
                        typeRegistry.get(
                            attr(
                                child(child(n, 'FunctionArguments'), 'FunctionReturn'),
                                'typeid'
                            )
                        )!.cTypeName
                    } __func_${attr(n, 'name')}(${children(
                        child(n, 'FunctionArguments'),
                        'FunctionArgument'
                    ).map(
                        e =>
                            expect(
                                typeRegistry.get(attr(e, 'typeid')),
                                "Function:FunctionArguments:FunctionArgument does not have a vaild typeid (it'ss " +
                                    attr(e, 'typeid') +
                                    ')'
                            ).cTypeName + ` ${attr(e, 'name')}`
                    )});`,
                    ''
                )
            }
            if (p == Pass.PassValueTypePropagation) {
                let popctx = pushctx({
                    returnType: attr(
                        child(child(n, 'FunctionArguments'), 'FunctionReturn'),
                        'typeid'
                    ),
                    locals: new Map(
                        children(child(n, 'FunctionArguments'), 'FunctionArgument').map(
                            e => [
                                attr(e, 'name'),
                                (expect(
                                    typeRegistry.get(attr(e, 'typeid')),
                                    'broken typeid on argument!'
                                ),
                                attr(e, 'typeid'))
                            ]
                        )
                    )
                })
                compile(n.children[1], p, false)
                compile(Node('RAIIEnd', [], []), p, false)
                popctx()
                return CompilationResult()
            }
            abort('todo: ' + Pass[p])
        }
        if (n.id == 'Call') {
            {
                let r = plugcheck(n, n.children[0], child(n, 'CallArgs').children, p)
                if (r) return r
            }

            if (p == Pass.PassFunctionTypePropagation) return CompilationResult()
            if (p == Pass.PassPreCompile) {
                if (
                    n.children[0].id == 'Variable' &&
                    attr(n.children[0], 'name') == 'Global'
                ) {
                    let target = attr(child(child(n, 'CallArgs'), 'Variable'), 'name')
                    return CompilationResult(`alias("${target}");`)
                }
            }
            if (p == Pass.PassValueTypePropagation) {
                if (
                    n.children[0].id == 'Variable' &&
                    attr(n.children[0], 'name') == 'c'
                ) {
                    n.children[2].children.forEach(e => compile(e, p, istoplevel))
                    let resultty = attr(
                        child(n, 'GenericArguments').children[0],
                        'typeid'
                    )
                    n.args.push(Argument('typeid', resultty))
                    for (let c of child(n, 'CallArgs').children[1].children) {
                        compile(c.children[0], p, istoplevel)
                    }
                    return CompilationResult()
                }
                if (
                    n.children[0].id == 'Variable' &&
                    attr(n.children[0], 'name') == 'Global'
                ) {
                    return CompilationResult()
                }
                compile(n.children[0], p, istoplevel)
                n.children[1].children.forEach(e => compile(e, p, istoplevel))
                expect(
                    {
                        // TODO: ADD ALL NODES HERE
                        Variable: 1
                    }[n.children[0].id],
                    'missing node from call member table, add it there: ' +
                        n.children[0].id
                )
                // TODO: how to do this?
                if (n.children[0].id == 'MemberExpresison') {
                    abort('todo')
                } else {
                    let tgd = expect(
                        typeRegistry.get(attr(n.children[0], 'typeid')),
                        'typeid was invalid'
                    )
                    let typeOther = tgd.opCall(
                        false,
                        n.children[1].children.map(e =>
                            expect(typeRegistry.get(attr(e, 'typeid')), 'broken typeid')
                        )
                    )
                    n.args.push(Argument('typeid', typeOther.name))
                    return CompilationResult()
                }
            }
            if (p == Pass.PassCompile) {
                if (
                    n.children[0].id == 'Variable' &&
                    attr(n.children[0], 'name') == 'c'
                ) {
                    let cr = CompilationResult()
                    let resultty = attr(
                        child(n, 'GenericArguments').children[0],
                        'typeid'
                    )
                    let resultnm = expect(
                        typeRegistry.get(resultty),
                        'broken typeid'
                    ).cTypeName
                    let code = attr(child(n, 'CallArgs').children[0], 'str')
                    for (let c of child(n, 'CallArgs').children[1].children) {
                        code = code.replaceAll(
                            `{${attr(c, 'name')}}`,
                            Append(cr, compile(c.children[0], p, istoplevel))
                        )
                    }
                    return CompilationResult(`((${resultnm})(${code}))`)
                }
                let cr = CompilationResult('', '')
                let args = child(n, 'CallArgs').children.map(e => {
                    return Append(cr, compile(e, p, istoplevel))
                })
                if (
                    n.children[0].id == 'Variable' &&
                    attr(n.children[0], 'name') == 'Global'
                ) {
                    return CompilationResult('', '')
                }
                // TODO: how to do this?
                if (n.children[0].id == 'MemberExpresison') {
                    abort('todo')
                } else {
                    let tgd = expect(
                        typeRegistry.get(attr(n.children[0], 'typeid')),
                        'broken typeid'
                    )
                    return CompilationResult(
                        `${tgd.cTypeName}(${args.join(', ')})`,
                        cr.code
                    )
                }
            }
        }
        if (n.id == 'BlockStatement') {
            if (p == Pass.PassCompile) {
                let cr = CompilationResult()
                n.children.map(
                    e =>
                        // this looks super wtf, but you need this meme for it to work (because of order of operations)
                        (cr.code = [Append(cr, compile(e, p, istoplevel)) + ';', cr.code]
                            .reverse()
                            .join(''))
                )
                return cr
            }
            if (p == Pass.PassValueTypePropagation) {
                n.children.forEach(e => compile(e, p, istoplevel))
                return CompilationResult()
            }
        }
        if (n.id == 'ReturnStmt') {
            if (p == Pass.PassValueTypePropagation) {
                compile(Node('RAIIEnd', [], []), p, istoplevel)
                n.children.forEach(e => compile(e, p, istoplevel))
                if (attr(n.children[0], 'typeid') != ctx().returnType)
                    abort(
                        `Error: type '${ctx().returnType}' expected, but foumd ${attr(
                            n.children[0],
                            'typeid'
                        )}`
                    )
                return CompilationResult()
            }
            if (p == Pass.PassCompile) {
                let cr = compile(n.children[0], p, istoplevel)
                let cr_raii = compile(Node('RAIIEnd', [], []), p, istoplevel)
                return CompilationResult(
                    '',
                    cr.code +
                        '\n' +
                        `{ ${expect(typeRegistry.get(attr(n.children[0], 'typeid')), 'broken typeid').cTypeName} __retval = ${cr.result};` +
                        cr_raii.code +
                        cr_raii.result +
                        'return __retval; }'
                )
            }
        }
        if (n.id == 'NoopNode') return CompilationResult()
        if (n.id == 'AddOp') {
            if (p == Pass.PassValueTypePropagation) {
                n.children.forEach(e => compile(e, p, istoplevel))
                let ltype = attr(n.children[0], 'typeid')
                let rtype = attr(n.children[1], 'typeid')
                let fn =
                    'opAdd$' +
                    createHash('sha256').update(rtype).digest('hex').slice(0, 8)
                let tgd = expect(typeRegistry.get(ltype), 'typeid was invalid')
                if (tgd.hasMember(fn)) {
                    let t = typeRegistry.get(rtype)!.memberType(fn)
                    let typeOther = t.opCall(true, [
                        expect(typeRegistry.get(rtype), 'broken type: ' + rtype)
                    ])
                    n.args.push(Argument('typeid', typeOther.name))
                    return CompilationResult()
                } else {
                    abort(
                        'Unable to add: ' +
                            ltype +
                            ' and ' +
                            rtype +
                            ' (' +
                            fn +
                            ' not found)'
                    )
                }
            }
            if (p == Pass.PassCompile) {
                let cr = CompilationResult()
                let [l, r] = n.children.map(e => Append(cr, compile(e, p, istoplevel)))
                let rtype = attr(n.children[1], 'typeid')
                let fn =
                    'opAdd$' +
                    createHash('sha256').update(rtype).digest('hex').slice(0, 8)
                let t = typeRegistry.get(rtype)!.memberType(fn)
                return CompilationResult(`${t.cTypeName}(${l}, ${r})`, cr.code)
            }
        }
        if (n.id == 'Variable') {
            if (p == Pass.PassValueTypePropagation) {
                if (typeRegistry.has('#func:' + attr(n, 'name'))) {
                    n.args.push(Argument('typeid', '#func:' + attr(n, 'name')))
                } else if (attr(n, 'name') == 'Global') {
                    return CompilationResult()
                } else {
                    n.args.push(
                        Argument(
                            'typeid',
                            validate(
                                ctx().locals.get(attr(n, 'name')),
                                'unknown local: ' + attr(n, 'name')
                            )
                        )
                    )
                }
                return CompilationResult()
            }
            if (p == Pass.PassCompile) {
                if (attr(n, 'name') == 'Global') {
                    return CompilationResult()
                } else {
                    return CompilationResult(attr(n, 'name'))
                }
            }
        }
        if (n.id == 'NumberConst') {
            if (attrs(n, 'typeid').length !== 1) n.args.push(Argument('typeid', 'number'))
            return CompilationResult(attr(n, 'str'))
        }
        if (n.id == 'MemberAccess') {
        }
        // RAIIBegin is a special node compiled in whenever a function starts (for declaring locals etc.).
        if (n.id == 'RAIIBegin') return CompilationResult()

        // RAIIEnd is a special node compiled in whenever anything returns, for, you guessed it, RAII.
        if (n.id == 'RAIIEnd') return CompilationResult()

        // TopNode is a special node compiled in at the top of the code between PassPreCompile and PassCompile
        if (n.id == 'TopNode') return CompilationResult()

        abort('TODO: ' + n.id + ' when performing ' + Pass[p])
    },
    node => {
        return [...plugins.values()]
            .map(e => e.$hooks)
            .filter(e => e)
            .map(e => e![node.id])
            .filter(e => e) as any
    }
)

init()

let r = CompilationResult('', '#include "leamscript.h"\n')
parseResult.forEach(e => compile(e, Pass.PassPrevalidate, true))
parseResult.forEach(e => compile(e, Pass.PassFunctionTypePropagation, true))
parseResult.forEach(e => compile(e, Pass.PassValueTypePropagation, true))
parseResult
    .map(e => AppendFull(r, compile(e, Pass.PassPreCompile, true)))
    .join('\n');
[Node('TopNode', [], []), ...parseResult]
    .map(e => AppendFull(r, compile(e, Pass.PassCompile, true)))
    .join('\n')
console.log(r.code)
