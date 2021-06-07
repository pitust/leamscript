import {
    abort,
    attr,
    CompilationResult,
    createContextManager,
    expect,
    Pass,
    string,
    Type
} from '../../src/index'
import { Node } from '../../src/parser'

const { pushctx, ctx } = createContextManager<string>()

export function current(p: Pass, args: Node[]): Node | CompilationResult | Type {
    if (p == Pass.PassValueTypePropagation) return string
    if (p != Pass.PassCompile) abort('ICE: todo')
    return CompilationResult(JSON.stringify(ctx()))
}
export function caller(p: Pass, args: Node[]): Node | CompilationResult | Type {
    if (p == Pass.PassValueTypePropagation) return string
    if (p != Pass.PassCompile) abort('ICE: todo')
    return CompilationResult('__parentfn')
}
export const $hooks = {
    *Function(
        tw: [CompilationResult | null, (a: CompilationResult | null) => void],
        n: Node,
        p: Pass
    ) {
        if (p != Pass.PassCompile) return
        let popctx = pushctx(attr(n, 'name'))
        yield
        popctx()
    },
    *RAIIBegin(
        tw: [CompilationResult | null, (a: CompilationResult | null) => void],
        n: Node,
        p: Pass
    ) {
        if (p != Pass.PassCompile) return
        yield
        expect(tw, 'ICE')[0]!.code += `const char* __pcall = __nextcaller(${JSON.stringify(ctx())});`
    },
    *RAIIEnd(
        tw: [CompilationResult | null, (a: CompilationResult | null) => void],
        n: Node,
        p: Pass
    ) {
        if (p != Pass.PassCompile) return
        yield
        expect(tw, 'ICE')[0]!.code += '__prevcaller(__pcall);'
    },
    *TopNode(
        tw: [CompilationResult | null, (a: CompilationResult | null) => void],
        n: Node,
        p: Pass
    ) {
        if (p != Pass.PassCompile) abort('ICE: WTF???')
        yield
        expect(tw, 'ICE')[0]!.code += `
        __thread const char* __parentfn = "<no parent>";
        __thread const char* __currentfn = "<unknown>";
        const char* __nextcaller(const char* name) {
            const char* a = __parentfn;
            __parentfn = __currentfn;
            __currentfn = name;
            return a;
        }
        void __prevcaller(const char* old) {
            __currentfn = __parentfn;
            __parentfn = old;
        }
        `
    }
}
