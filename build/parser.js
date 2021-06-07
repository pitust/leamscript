"use strict";
exports.__esModule = true;
exports.parseResult = exports.Argument = exports.Node = void 0;
// ** Beware: this is very ugly **
//  this code constructs an AST via a questionable hand-coded parser.
//  at least it's not ambigous, and succeds at most sane typescript code.
var fs_1 = require("fs");
var util_1 = require("util");
var LexemeType;
(function (LexemeType) {
    LexemeType[LexemeType["Ident"] = 0] = "Ident";
    LexemeType[LexemeType["Number"] = 1] = "Number";
    LexemeType[LexemeType["Keyword"] = 2] = "Keyword";
    LexemeType[LexemeType["Symbol"] = 3] = "Symbol";
    LexemeType[LexemeType["String"] = 4] = "String";
})(LexemeType || (LexemeType = {}));
function lex(s) {
    var symbols = [
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
    ];
    var keywords = [
        'import',
        'from',
        'enum',
        'while',
        'let',
        'return',
        'if',
        'interface',
        'function'
    ];
    var whitespace = ' \t\n';
    var lexemes = [];
    var oldstring = s;
    function lexerGetPosition() {
        var offset = oldstring.slice(0, oldstring.lastIndexOf(s));
        var line = offset.split('').filter(function (e) { return e == '\n'; }).length + 1;
        var column = offset.split('\n').slice(-1)[0].length - 2;
        return { line: line, column: column };
    }
    while (s.length) {
        if (s.startsWith('//')) {
            s = s.slice(2);
            while (s[0] != '\n' && s.length)
                s = s.slice(1);
            continue;
        }
        if (whitespace.includes(s[0])) {
            s = s.slice(1);
            continue;
        }
        if ('0123456789'.includes(s[0])) {
            var o = '';
            while ('0123456789'.includes(s[0])) {
                o += s[0];
                s = s.slice(1);
            }
            lexemes.push([LexemeType.Number, o, lexerGetPosition()]);
            continue;
        }
        if ('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_$'.includes(s[0])) {
            var o = '';
            while ('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_$0123456789'.includes(s[0])) {
                o += s[0];
                s = s.slice(1);
            }
            if (keywords.includes(o)) {
                lexemes.push([LexemeType.Keyword, o, lexerGetPosition()]);
            }
            else {
                lexemes.push([LexemeType.Ident, o, lexerGetPosition()]);
            }
            continue;
        }
        if (symbols.find(function (e) { return s.startsWith(e); })) {
            var sym = symbols.find(function (e) { return s.startsWith(e); });
            lexemes.push([LexemeType.Symbol, sym, lexerGetPosition()]);
            s = s.slice(sym.length);
            continue;
        }
        if (s[0] == '"' || s[0] == "'") {
            var buf = s[0];
            var o = '';
            s = s.slice(1);
            while (s.length) {
                try {
                    o = eval(buf);
                    break;
                }
                catch (_a) {
                    buf += s[0];
                    s = s.slice(1);
                }
            }
            lexemes.push([LexemeType.String, o, lexerGetPosition()]);
            continue;
        }
        console.log('ERROR: unable to lex: %o', s[0]);
        process.exit(1);
    }
    return lexemes;
}
function tokCmp(a, t) {
    if (!a.length)
        return null;
    if (a[0][0] != t)
        return null;
    return a[0][1];
}
function tokAssert(a, t, s2) {
    if (s2 === void 0) { s2 = null; }
    if (a[0][0] != t)
        abort('Invalid token found: ' + LexemeType[a[0][0]] + ' ' + a[0][1], a);
    if (a[0][1] !== s2 && s2 !== null)
        abort('Invalid token found: ' + LexemeType[a[0][0]] + ' ' + a[0][1], a);
    var b = a[0][1];
    a.shift();
    return b;
}
function typeck(t, decider) {
    return decider(t) ? t : null;
}
function abort(e, l) {
    var _a;
    var loc;
    if ((loc = (_a = typeck(l[0], function (t) { return (t === null || t === void 0 ? void 0 : t.length) == 3; })) === null || _a === void 0 ? void 0 : _a[2])) {
        console.log("Error @ ./target.ts:" + loc.line + ":" + loc.column + "  " + e);
        process.exit(2);
    }
    console.trace(e);
    process.exit(2);
}
function Node(id, args, children) {
    return { id: id, args: args, children: children };
}
exports.Node = Node;
function Argument(typeHint, argument) {
    return { typeHint: typeHint, argument: argument };
}
exports.Argument = Argument;
// parseImportSource := keyword:'from' string:_ symbol:';'
function parseImportSource(l, s) {
    tokAssert(l, LexemeType.Keyword, 'from');
    var src = Argument('importSource', tokAssert(l, LexemeType.String));
    tokAssert(l, LexemeType.Symbol, ';');
    return Node('Import', [src], s.map(function (e) { return Node('ImportTarget', [Argument('target', e)], []); }));
}
// parseImport := symbol:'{' (ident:_ (symbol:',' ident:_)*)? symbol:'}' parseImportSource
function parseImport(l) {
    tokAssert(l, LexemeType.Symbol, '{');
    if (tokCmp(l, LexemeType.Symbol)) {
        tokAssert(l, LexemeType.Symbol, '}');
        return parseImportSource(l, []);
    }
    var o = [tokAssert(l, LexemeType.Ident)];
    while (tokCmp(l, LexemeType.Symbol) != '}') {
        tokAssert(l, LexemeType.Symbol, ',');
        o.push(tokAssert(l, LexemeType.Ident));
    }
    tokAssert(l, LexemeType.Symbol, '}');
    return parseImportSource(l, o);
}
// parseEnum := ident:_ symbol:'{' (ident:_ (symbol:',' ident:_)*)? symbol:'}'
function parseEnum(l) {
    var name = tokAssert(l, LexemeType.Ident);
    tokAssert(l, LexemeType.Symbol, '{');
    var o = [tokAssert(l, LexemeType.Ident)];
    while (tokCmp(l, LexemeType.Symbol) != '}') {
        tokAssert(l, LexemeType.Symbol, ',');
        if (tokCmp(l, LexemeType.Symbol) === '}')
            break;
        o.push(tokAssert(l, LexemeType.Ident));
    }
    tokAssert(l, LexemeType.Symbol, '}');
    return Node('Enum', [Argument('name', name)], o.map(function (e) { return Node('EnumElement', [Argument('name', e)], []); }));
}
// parseType := ident:_
function parseType(l) {
    if (tokCmp(l, LexemeType.Symbol) == '[') {
        tokAssert(l, LexemeType.Symbol, '[');
        var args = [];
        args.push(parseType(l));
        while (tokCmp(l, LexemeType.Symbol) != ']') {
            tokAssert(l, LexemeType.Symbol, ',');
            args.push(parseType(l));
        }
        tokAssert(l, LexemeType.Symbol, ']');
        return Node('TypeTuple', [], args);
    }
    var a = tokAssert(l, LexemeType.Ident);
    while (tokCmp(l, LexemeType.Symbol) == '.') {
        l.shift();
        a += '.' + tokAssert(l, LexemeType.Ident);
    }
    if (tokCmp(l, LexemeType.Symbol) == '<') {
        tokAssert(l, LexemeType.Symbol, '<');
        var args = [];
        args.push(parseType(l));
        while (tokCmp(l, LexemeType.Symbol) != '>') {
            tokAssert(l, LexemeType.Symbol, ',');
            args.push(parseType(l));
        }
        tokAssert(l, LexemeType.Symbol, '>');
        return Node('TypeGeneric', [Argument('name', a)], args);
    }
    return Node('TypeIdent', [Argument('name', a)], []);
}
function prec(l, cmp, eat, cb, gen) {
    var result = [cb()];
    if (!cmp())
        return result[0];
    while (cmp()) {
        eat();
        result.push(cb());
    }
    return gen(result);
}
function prettyPrec(l, lt, s, cb) {
    var result = [cb()];
    while (tokCmp(l, lt) === s) {
        l.shift();
        result.push(cb());
    }
    return result;
}
var parseExpr = (function () {
    var cur = function (l) {
        if (tokCmp(l, LexemeType.Symbol) == '[') {
            l.shift();
            if (tokCmp(l, LexemeType.Symbol) == ']') {
                tokAssert(l, LexemeType.Symbol, ']');
                return Node('ArrayExpr', [], []);
            }
            var res = Node('ArrayExpr', [], prettyPrec(l, LexemeType.Symbol, ',', function () { return parseExpr(l); }));
            tokAssert(l, LexemeType.Symbol, ']');
            return res;
        }
        if (tokCmp(l, LexemeType.String)) {
            return Node('StringConst', [Argument('str', tokAssert(l, LexemeType.String))], []);
        }
        if (tokCmp(l, LexemeType.Number)) {
            return Node('NumberConst', [Argument('str', tokAssert(l, LexemeType.Number))], []);
        }
        if (tokCmp(l, LexemeType.Ident)) {
            return Node('Variable', [Argument('name', tokAssert(l, LexemeType.Ident))], []);
        }
        if (tokCmp(l, LexemeType.Symbol) == '{') {
            tokAssert(l, LexemeType.Symbol, '{');
            var f = Node('ObjectLiteral', [], []);
            while (tokCmp(l, LexemeType.Symbol) != '}') {
                var id = tokCmp(l, LexemeType.String)
                    ? tokAssert(l, LexemeType.String)
                    : tokAssert(l, LexemeType.Ident);
                tokAssert(l, LexemeType.Symbol, ':');
                f.children.push(Node('ObjectField', [Argument('name', id)], [parseExpr(l)]));
                if (tokCmp(l, LexemeType.Symbol) == ',')
                    tokAssert(l, LexemeType.Symbol, ',');
            }
            tokAssert(l, LexemeType.Symbol, '}');
            return f;
        }
        console.log(l);
        abort('todo: ' + LexemeType[l[0][0]] + ' ' + l[0][1], l);
    };
    {
        var old_1 = cur;
        cur = function (l) {
            var a = old_1(l);
            while (tokCmp(l, LexemeType.Symbol) == '.') {
                l.shift();
                a = Node('MemberAccess', [Argument('member', tokAssert(l, LexemeType.Ident))], [a]);
            }
            while (tokCmp(l, LexemeType.Symbol) == '(' ||
                tokCmp(l, LexemeType.Symbol) == '<') {
                var types = [];
                if (tokCmp(l, LexemeType.Symbol) == '<') {
                    l.unshift([LexemeType.Ident, '__fake']);
                    var p_1 = parseType(l);
                    types = p_1.children;
                }
                tokAssert(l, LexemeType.Symbol, '(');
                var args = prettyPrec(l, LexemeType.Symbol, ',', function () { return parseExpr(l); });
                tokAssert(l, LexemeType.Symbol, ')');
                a = Node('Call', [], [a, Node('CallArgs', [], args), Node('GenericArguments', [], types)]);
            }
            while (tokCmp(l, LexemeType.Symbol) == '[') {
                l.shift();
                var e = parseExpr(l);
                tokAssert(l, LexemeType.Symbol, ']');
                a = Node('Call', [], [
                    Node('MemberAccess', [Argument('member', '__index')], [a]),
                    Node('CallArgs', [], [e])
                ]);
            }
            return a;
        };
    }
    function updatePrec(sym, com) {
        var old = cur;
        cur = function (l) {
            return prec(l, function () { return tokCmp(l, LexemeType.Symbol) === sym; }, function () { return void tokAssert(l, LexemeType.Symbol, sym); }, function () {
                return old(l);
            }, function (a) {
                return Node(com, [], a);
            });
        };
    }
    updatePrec('=', 'AssignmentOp');
    updatePrec('+', 'AddOp');
    updatePrec('!=', 'NotEqualOp'); // 11
    updatePrec('&&', 'LogicAndOp'); // 7
    return cur;
})();
// parseVariableStmt := keyword:'let' ident:_ symbol:'=' parseExpr
function parseVariableStmt(l) {
    tokAssert(l, LexemeType.Keyword, 'let');
    var name = tokAssert(l, LexemeType.Ident);
    if (tokCmp(l, LexemeType.Symbol) == ':') {
        tokAssert(l, LexemeType.Symbol, ':');
        var ty = parseType(l);
        tokAssert(l, LexemeType.Symbol, '=');
        var expr_1 = parseExpr(l);
        return Node('VariableStmt', [Argument('name', name)], [ty, expr_1]);
    }
    tokAssert(l, LexemeType.Symbol, '=');
    var expr = parseExpr(l);
    return Node('VariableStmt', [Argument('name', name)], [expr]);
}
// parseWhileStmt := symbol:'while' symbol:'(' parseExpr symbol:')' parseStmt
function parseWhileStmt(l) {
    tokAssert(l, LexemeType.Keyword, 'while');
    tokAssert(l, LexemeType.Symbol, '(');
    var e = parseExpr(l);
    tokAssert(l, LexemeType.Symbol, ')');
    var b = parseStmt(l);
    return Node('WhileStmt', [], [e, b]);
}
// parseIfStmt := symbol:'if' symbol:'(' parseExpr symbol:')' parseStmt
function parseIfStmt(l) {
    tokAssert(l, LexemeType.Keyword, 'if');
    tokAssert(l, LexemeType.Symbol, '(');
    var e = parseExpr(l);
    tokAssert(l, LexemeType.Symbol, ')');
    var b = parseStmt(l);
    return Node('IfStmt', [], [e, b]);
}
// parseReturnStmt := symbol:'return' parseExpr
function parseReturnStmt(l) {
    tokAssert(l, LexemeType.Keyword, 'return');
    var a = parseExpr(l);
    return Node('ReturnStmt', [], [a]);
}
function parseStmt(l) {
    if (tokCmp(l, LexemeType.Symbol) == '{')
        return parseBlockStatement(l);
    if (tokCmp(l, LexemeType.Symbol) == ';')
        tokAssert(l, LexemeType.Symbol, ';');
    if (tokCmp(l, LexemeType.Keyword) == 'let')
        return parseVariableStmt(l);
    if (tokCmp(l, LexemeType.Keyword) == 'while')
        return parseWhileStmt(l);
    if (tokCmp(l, LexemeType.Keyword) == 'if')
        return parseIfStmt(l);
    if (tokCmp(l, LexemeType.Keyword) == 'return')
        return parseReturnStmt(l);
    return parseExpr(l);
}
// parseBlockStatement := symbol:'{' (parseStmt symbol:';'?)* symbol:'}'
function parseBlockStatement(l) {
    tokAssert(l, LexemeType.Symbol, '{');
    var b = [];
    while (tokCmp(l, LexemeType.Symbol) != '}') {
        b.push(parseStmt(l));
        if (tokCmp(l, LexemeType.Symbol) == ';')
            tokAssert(l, LexemeType.Symbol, ';');
    }
    tokAssert(l, LexemeType.Symbol, '}');
    return Node('BlockStatement', [], b);
}
// parseFunction := ident:_ symbol:'(' (ident:_ symbol:':' parseType (symbol:',' ident:_ symbol:':' parseType)*)? symbol:')' (symbol:':' parseType)? parseBlockStatement
function parseFunction(l) {
    var name = tokAssert(l, LexemeType.Ident);
    tokAssert(l, LexemeType.Symbol, '(');
    var args = [];
    while (tokCmp(l, LexemeType.Symbol) != ')') {
        var id = tokAssert(l, LexemeType.Ident);
        tokAssert(l, LexemeType.Symbol, ':');
        args.push(Node('FunctionArgument', [Argument('name', id)], [parseType(l)]));
    }
    tokAssert(l, LexemeType.Symbol, ')');
    if (tokCmp(l, LexemeType.Symbol) == ':') {
        tokAssert(l, LexemeType.Symbol, ':');
        args.push(Node('FunctionReturn', [], [parseType(l)]));
    }
    else {
        args.push(Node('FunctionReturn', [], [Node('TypeIdent', [Argument('name', 'void')], [])]));
    }
    return Node('Function', [Argument('name', name)], [Node('FunctionArguments', [], args), parseBlockStatement(l)]);
}
// parseTopLevel := keyword:"import" parseImport |
//                   keyword:"enum" parseEnum | keyword:"function" parseFunction | keyword:"let" parseLet | parseStmt symbol:';'?
function parseTopLevel(l) {
    while (tokCmp(l, LexemeType.Symbol) == ';')
        tokAssert(l, LexemeType.Symbol, ';');
    if (l.length === 0)
        return Node('NoopNode', [], []);
    if (tokCmp(l, LexemeType.Keyword) == 'import') {
        l.shift();
        return parseImport(l);
    }
    if (tokCmp(l, LexemeType.Keyword) == 'enum') {
        l.shift();
        return parseEnum(l);
    }
    if (tokCmp(l, LexemeType.Keyword) == 'function') {
        l.shift();
        return parseFunction(l);
    }
    return parseStmt(l);
}
// parseGlobal := parseTopLevel*
function parseGlobal(l) {
    var o = [];
    while (l.length) {
        o.push(parseTopLevel(l));
    }
    return o;
}
util_1.inspect.defaultOptions.depth = Infinity;
var s = fs_1.readFileSync('./target.ts').toString();
var p = lex(s);
exports.parseResult = parseGlobal(p);
