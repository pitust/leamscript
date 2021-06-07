// ** Beware: this is very ugly **
//  this code constructs an AST via a questionable hand-coded parser.
//  at least it's not ambigous, and succeds at most sane typescript code.
import { readFileSync } from 'fs'
import { inspect } from 'util'

enum LexemeType {
    Ident,
    Number,
    Keyword,
    Symbol,
    String
}

function lex(s: string) {
    let symbols = [
        ':',
        '{',
        '}',
        '(',
        ')',
        '<',
        '>',
        '+=',
        '-=',
        '/=',
        '!=',
        '&&=',
        '&&',
        '/',
        '=',
        '+',
        '[',
        ']',
        ',',
        '.',
        ';',
        '||=',
        '||',
        '|=',
        '|',
        '!',
        '-'
    ]
    let keywords = ['import', 'from', 'enum', 'while', 'let', 'return', 'if', 'interface', 'function']
    let whitespace = ' \t\n'
    let lexemes: Array<[LexemeType, string, { line: number; column: number }]> = []
    let oldstring = s
    function lexerGetPosition() {
        let offset = oldstring.slice(0, oldstring.lastIndexOf(s))
        let line = offset.split('').filter(e => e == '\n').length + 1
        let column = offset.split('\n').slice(-1)[0].length - 2
        return { line, column }
    }
    while (s.length) {
        if (s.startsWith('//')) {
            s = s.slice(2)
            while (s[0] != '\n' && s.length) s = s.slice(1)
            continue
        }
        if (whitespace.includes(s[0])) {
            s = s.slice(1)
            continue
        }

        if ('0123456789'.includes(s[0])) {
            let o = ''
            while ('0123456789'.includes(s[0])) {
                o += s[0]
                s = s.slice(1)
            }
            lexemes.push([LexemeType.Number, o, lexerGetPosition()])
            continue
        }

        if ('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_$'.includes(s[0])) {
            let o = ''
            while ('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_$0123456789'.includes(s[0])) {
                o += s[0]
                s = s.slice(1)
            }
            if (keywords.includes(o)) {
                lexemes.push([LexemeType.Keyword, o, lexerGetPosition()])
            } else {
                lexemes.push([LexemeType.Ident, o, lexerGetPosition()])
            }
            continue
        }

        if (symbols.find(e => s.startsWith(e))) {
            let sym = symbols.find(e => s.startsWith(e))!
            lexemes.push([LexemeType.Symbol, sym, lexerGetPosition()])
            s = s.slice(sym.length)
            continue
        }

        if (s[0] == '"' || s[0] == "'") {
            let buf = s[0]
            let o = ''
            s = s.slice(1)
            while (s.length) {
                try {
                    o = eval(buf)
                    break
                } catch {
                    buf += s[0]
                    s = s.slice(1)
                }
            }
            lexemes.push([LexemeType.String, o, lexerGetPosition()])
            continue
        }

        console.log('ERROR: unable to lex: %o', s[0])
        process.exit(1)
    }
    return lexemes as unknown as Array<[LexemeType, string]>
}

function tokCmp(a: Array<[LexemeType, string]>, t: LexemeType): null | string {
    if (!a.length) return null
    if (a[0][0] != t) return null
    return a[0][1]
}
function tokAssert(a: Array<[LexemeType, string]>, t: LexemeType, s2: string | null = null): string {
    if (a[0][0] != t) abort('Invalid token found: ' + LexemeType[a[0][0]] + ' ' + a[0][1], a)
    if (a[0][1] !== s2 && s2 !== null) abort('Invalid token found: ' + LexemeType[a[0][0]] + ' ' + a[0][1], a)
    let b = a[0][1]
    a.shift()
    return b
}

function typeck<T, U>(t: T | U, decider: (t: T | U) => boolean): U | null {
    return decider(t) ? <U>t : null
}

function abort(e: string, l: Array<[LexemeType, string]>): never {
    let loc: { line: number; column: number }
    if (
        (loc = typeck<[LexemeType, string], [LexemeType, string, { line: number; column: number }]>(
            l[0],
            t => t?.length == 3
        )?.[2]!)
    ) {
        console.log(`Error @ ./target.ts:${loc.line}:${loc.column}  ${e}`)
        process.exit(2)
    }
    console.trace(e)
    process.exit(2)
}

export interface Argument {
    typeHint: string
    argument: string
}

export interface Node {
    id: string
    args: Array<Argument>
    children: Array<Node>
}

export function Node(id: string, args: Array<Argument>, children: Array<Node>): Node {
    return { id, args, children }
}
export function Argument(typeHint: string, argument: string): Argument {
    return { typeHint, argument }
}

// parseImportSource := keyword:'from' string:_ symbol:';'
function parseImportSource(l: Array<[LexemeType, string]>, s: string[]) {
    tokAssert(l, LexemeType.Keyword, 'from')
    let src = Argument('importSource', tokAssert(l, LexemeType.String))
    tokAssert(l, LexemeType.Symbol, ';')
    return Node(
        'Import',
        [src],
        s.map(e => Node('ImportTarget', [Argument('target', e)], []))
    )
}

// parseImport := symbol:'{' (ident:_ (symbol:',' ident:_)*)? symbol:'}' parseImportSource
function parseImport(l: Array<[LexemeType, string]>) {
    tokAssert(l, LexemeType.Symbol, '{')
    if (tokCmp(l, LexemeType.Symbol)) {
        tokAssert(l, LexemeType.Symbol, '}')
        return parseImportSource(l, [])
    }
    let o = [tokAssert(l, LexemeType.Ident)]
    while (tokCmp(l, LexemeType.Symbol) != '}') {
        tokAssert(l, LexemeType.Symbol, ',')
        o.push(tokAssert(l, LexemeType.Ident))
    }
    tokAssert(l, LexemeType.Symbol, '}')
    return parseImportSource(l, o)
}

// parseEnum := ident:_ symbol:'{' (ident:_ (symbol:',' ident:_)*)? symbol:'}'
function parseEnum(l: Array<[LexemeType, string]>) {
    let name = tokAssert(l, LexemeType.Ident)
    tokAssert(l, LexemeType.Symbol, '{')
    let o = [tokAssert(l, LexemeType.Ident)]
    while (tokCmp(l, LexemeType.Symbol) != '}') {
        tokAssert(l, LexemeType.Symbol, ',')
        if (tokCmp(l, LexemeType.Symbol) === '}') break
        o.push(tokAssert(l, LexemeType.Ident))
    }
    tokAssert(l, LexemeType.Symbol, '}')
    return Node(
        'Enum',
        [Argument('name', name)],
        o.map(e => Node('EnumElement', [Argument('name', e)], []))
    )
}

// parseType := ident:_
function parseType(l: Array<[LexemeType, string]>) {
    if (tokCmp(l, LexemeType.Symbol) == '[') {
        tokAssert(l, LexemeType.Symbol, '[')
        let args: Array<Node> = []
        args.push(parseType(l))
        while (tokCmp(l, LexemeType.Symbol) != ']') {
            tokAssert(l, LexemeType.Symbol, ',')
            args.push(parseType(l))
        }
        tokAssert(l, LexemeType.Symbol, ']')
        return Node('TypeTuple', [], args)
    }
    let a = tokAssert(l, LexemeType.Ident)
    while (tokCmp(l, LexemeType.Symbol) == '.') {
        l.shift()
        a += '.' + tokAssert(l, LexemeType.Ident)
    }
    if (tokCmp(l, LexemeType.Symbol) == '<') {
        tokAssert(l, LexemeType.Symbol, '<')
        let args: Array<Node> = []
        args.push(parseType(l))
        while (tokCmp(l, LexemeType.Symbol) != '>') {
            tokAssert(l, LexemeType.Symbol, ',')
            args.push(parseType(l))
        }
        tokAssert(l, LexemeType.Symbol, '>')
        return Node('TypeGeneric', [Argument('name', a)], args)
    }
    return Node('TypeIdent', [Argument('name', a)], [])
}

function prec<T>(
    l: Array<[LexemeType, string]>,
    cmp: () => boolean,
    eat: () => void,
    cb: () => T,
    gen: (a: T[]) => T
): T {
    let result: Array<T> = [cb()]
    if (!cmp()) return result[0]
    while (cmp()) {
        eat()
        result.push(cb())
    }
    return gen(result)
}

function prettyPrec<T>(l: Array<[LexemeType, string]>, lt: LexemeType, s: string, cb: () => T): T[] {
    let result: Array<T> = [cb()]
    while (tokCmp(l, lt) === s) {
        l.shift()
        result.push(cb())
    }
    return result
}

const parseExpr = (() => {
    let cur = (l: Array<[LexemeType, string]>): Node => {
        if (tokCmp(l, LexemeType.Symbol) == '[') {
            l.shift()
            if (tokCmp(l, LexemeType.Symbol) == ']') {
                tokAssert(l, LexemeType.Symbol, ']')
                return Node('ArrayExpr', [], [])
            }
            let res = Node(
                'ArrayExpr',
                [],
                prettyPrec(l, LexemeType.Symbol, ',', () => parseExpr(l))
            )
            tokAssert(l, LexemeType.Symbol, ']')
            return res
        }
        if (tokCmp(l, LexemeType.String)) {
            return Node('StringConst', [Argument('str', tokAssert(l, LexemeType.String))], [])
        }
        if (tokCmp(l, LexemeType.Number)) {
            return Node('NumberConst', [Argument('str', tokAssert(l, LexemeType.Number))], [])
        }
        if (tokCmp(l, LexemeType.Ident)) {
            return Node('Variable', [Argument('name', tokAssert(l, LexemeType.Ident))], [])
        }
        if (tokCmp(l, LexemeType.Symbol) == '{') {
            tokAssert(l, LexemeType.Symbol, '{')
            let f = Node('ObjectLiteral', [], [])
            while (tokCmp(l, LexemeType.Symbol) != '}') {
                let id = tokCmp(l, LexemeType.String) ? tokAssert(l, LexemeType.String) : tokAssert(l, LexemeType.Ident)
                tokAssert(l, LexemeType.Symbol, ':')
                f.children.push(Node('ObjectField', [Argument('name', id)], [parseExpr(l)]))
                if (tokCmp(l, LexemeType.Symbol) == ',') tokAssert(l, LexemeType.Symbol, ',')
            }
            tokAssert(l, LexemeType.Symbol, '}')
            return f
        }
        console.log(l)
        abort('todo: ' + LexemeType[l[0][0]] + ' ' + l[0][1], l)
    }
    {
        let old = cur
        cur = (l: Array<[LexemeType, string]>) => {
            let a = old(l)
            while (tokCmp(l, LexemeType.Symbol) == '.') {
                l.shift()
                a = Node('MemberAccess', [Argument('member', tokAssert(l, LexemeType.Ident))], [a])
            }
            while (tokCmp(l, LexemeType.Symbol) == '(' || tokCmp(l, LexemeType.Symbol) == '<') {
                let types: Array<Node> = []
                if (tokCmp(l, LexemeType.Symbol) == '<') {
                    l.unshift([LexemeType.Ident, '__fake'])
                    let p = parseType(l)
                    types = p.children
                }
                tokAssert(l, LexemeType.Symbol, '(')
                let args =
                    tokCmp(l, LexemeType.Symbol) == ')' ? [] : prettyPrec(l, LexemeType.Symbol, ',', () => parseExpr(l))
                tokAssert(l, LexemeType.Symbol, ')')
                a = Node('Call', [], [a, Node('CallArgs', [], args), Node('GenericArguments', [], types)])
            }
            while (tokCmp(l, LexemeType.Symbol) == '[') {
                l.shift()
                let e = parseExpr(l)
                tokAssert(l, LexemeType.Symbol, ']')
                a = Node(
                    'Call',
                    [],
                    [Node('MemberAccess', [Argument('member', '__index')], [a]), Node('CallArgs', [], [e])]
                )
            }
            return a
        }
    }
    function updatePrec(sym: string, com: string) {
        let old = cur
        cur = (l: Array<[LexemeType, string]>) =>
            prec(
                l,
                () => tokCmp(l, LexemeType.Symbol) === sym,
                () => void tokAssert(l, LexemeType.Symbol, sym),
                () => {
                    return old(l)
                },
                (a: Node[]) => {
                    return Node(com, [], a)
                }
            )
    }
    updatePrec('=', 'AssignmentOp')
    updatePrec('+', 'AddOp')
    updatePrec('!=', 'NotEqualOp') // 11
    updatePrec('&&', 'LogicAndOp') // 7
    return cur
})()

// parseVariableStmt := keyword:'let' ident:_ symbol:'=' parseExpr
function parseVariableStmt(l: Array<[LexemeType, string]>) {
    tokAssert(l, LexemeType.Keyword, 'let')
    let name = tokAssert(l, LexemeType.Ident)
    if (tokCmp(l, LexemeType.Symbol) == ':') {
        tokAssert(l, LexemeType.Symbol, ':')
        let ty = parseType(l)
        tokAssert(l, LexemeType.Symbol, '=')
        let expr = parseExpr(l)
        return Node('VariableStmt', [Argument('name', name)], [ty, expr])
    }
    tokAssert(l, LexemeType.Symbol, '=')
    let expr = parseExpr(l)
    return Node('VariableStmt', [Argument('name', name)], [expr])
}

// parseWhileStmt := symbol:'while' symbol:'(' parseExpr symbol:')' parseStmt
function parseWhileStmt(l: Array<[LexemeType, string]>) {
    tokAssert(l, LexemeType.Keyword, 'while')
    tokAssert(l, LexemeType.Symbol, '(')
    let e = parseExpr(l)
    tokAssert(l, LexemeType.Symbol, ')')
    let b = parseStmt(l)
    return Node('WhileStmt', [], [e, b])
}

// parseIfStmt := symbol:'if' symbol:'(' parseExpr symbol:')' parseStmt
function parseIfStmt(l: Array<[LexemeType, string]>) {
    tokAssert(l, LexemeType.Keyword, 'if')
    tokAssert(l, LexemeType.Symbol, '(')
    let e = parseExpr(l)
    tokAssert(l, LexemeType.Symbol, ')')
    let b = parseStmt(l)
    return Node('IfStmt', [], [e, b])
}

// parseReturnStmt := symbol:'return' parseExpr
function parseReturnStmt(l: Array<[LexemeType, string]>) {
    tokAssert(l, LexemeType.Keyword, 'return')
    let a = parseExpr(l)
    return Node('ReturnStmt', [], [a])
}

function parseStmt(l: Array<[LexemeType, string]>): Node {
    if (tokCmp(l, LexemeType.Symbol) == '{') return parseBlockStatement(l)
    if (tokCmp(l, LexemeType.Symbol) == ';') tokAssert(l, LexemeType.Symbol, ';')
    if (tokCmp(l, LexemeType.Keyword) == 'let') return parseVariableStmt(l)
    if (tokCmp(l, LexemeType.Keyword) == 'while') return parseWhileStmt(l)
    if (tokCmp(l, LexemeType.Keyword) == 'if') return parseIfStmt(l)
    if (tokCmp(l, LexemeType.Keyword) == 'return') return parseReturnStmt(l)
    return parseExpr(l)
}

// parseBlockStatement := symbol:'{' (parseStmt symbol:';'?)* symbol:'}'
function parseBlockStatement(l: Array<[LexemeType, string]>) {
    tokAssert(l, LexemeType.Symbol, '{')
    let b: Array<Node> = []
    while (tokCmp(l, LexemeType.Symbol) != '}') {
        b.push(parseStmt(l))
        if (tokCmp(l, LexemeType.Symbol) == ';') tokAssert(l, LexemeType.Symbol, ';')
    }
    tokAssert(l, LexemeType.Symbol, '}')
    return Node('BlockStatement', [], b)
}

// parseFunction := ident:_ symbol:'(' (ident:_ symbol:':' parseType (symbol:',' ident:_ symbol:':' parseType)*)? symbol:')' (symbol:':' parseType)? parseBlockStatement
function parseFunction(l: Array<[LexemeType, string]>) {
    let name = tokAssert(l, LexemeType.Ident)
    tokAssert(l, LexemeType.Symbol, '(')
    let args: Array<Node> = []
    while (tokCmp(l, LexemeType.Symbol) != ')') {
        let id = tokAssert(l, LexemeType.Ident)
        tokAssert(l, LexemeType.Symbol, ':')
        args.push(Node('FunctionArgument', [Argument('name', id)], [parseType(l)]))
    }
    tokAssert(l, LexemeType.Symbol, ')')
    if (tokCmp(l, LexemeType.Symbol) == ':') {
        tokAssert(l, LexemeType.Symbol, ':')
        args.push(Node('FunctionReturn', [], [parseType(l)]))
    } else {
        args.push(Node('FunctionReturn', [], [Node('TypeIdent', [Argument('name', 'void')], [])]))
    }
    return Node('Function', [Argument('name', name)], [Node('FunctionArguments', [], args), parseBlockStatement(l)])
}

// parseTopLevel := keyword:"import" parseImport |
//                   keyword:"enum" parseEnum | keyword:"function" parseFunction | keyword:"let" parseLet | parseStmt symbol:';'?
function parseTopLevel(l: Array<[LexemeType, string]>) {
    while (tokCmp(l, LexemeType.Symbol) == ';') tokAssert(l, LexemeType.Symbol, ';')
    if (l.length === 0) return Node('NoopNode', [], [])
    if (tokCmp(l, LexemeType.Keyword) == 'import') {
        l.shift()
        return parseImport(l)
    }
    if (tokCmp(l, LexemeType.Keyword) == 'enum') {
        l.shift()
        return parseEnum(l)
    }
    if (tokCmp(l, LexemeType.Keyword) == 'function') {
        l.shift()
        return parseFunction(l)
    }
    return parseStmt(l)
}

// parseGlobal := parseTopLevel*
function parseGlobal(l: Array<[LexemeType, string]>) {
    let o: Array<Node> = []
    while (l.length) {
        o.push(parseTopLevel(l))
    }
    return o
}

inspect.defaultOptions.depth = Infinity

let s = readFileSync('./target.ts').toString()
let p = lex(s)
export const parseResult = parseGlobal(p)
