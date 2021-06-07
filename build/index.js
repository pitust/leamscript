"use strict";
exports.__esModule = true;
var crypto_1 = require("crypto");
var parser_1 = require("./parser");
var Pass;
(function (Pass) {
    Pass[Pass["PassPrevalidate"] = 0] = "PassPrevalidate";
    Pass[Pass["PassFunctionTypePropagation"] = 1] = "PassFunctionTypePropagation";
    Pass[Pass["PassValueTypePropagation"] = 2] = "PassValueTypePropagation";
    Pass[Pass["PassCompile"] = 3] = "PassCompile";
    Pass[Pass["PassPreCompile"] = 4] = "PassPreCompile";
})(Pass || (Pass = {}));
function CompilationResult(result, code) {
    if (result === void 0) { result = ''; }
    if (code === void 0) { code = ''; }
    return { result: result, code: code };
}
function Append(r, r2) {
    r.code = r.code + r2.code;
    return r2.result;
}
function abort(e) {
    console.trace(e);
    process.exit(2);
}
var typeRegistry = new Map();
function factoryType(t) {
    var o = {};
    Object.assign(o, t(o));
    typeRegistry.set(o.name, o);
    return o;
}
var add_number = function (other) {
    return factoryType(function (self) { return ({
        name: '#intadd#' + other.name,
        cTypeName: '__runtimeAddInt(' + other.cTypeName + ')',
        genericApply: function () {
            abort('ICE: invariant violated');
        },
        hasMember: function () {
            return false;
        },
        getMemberGetterName: function () {
            abort('ICE: invariant violated');
        },
        memberType: function () {
            abort('ICE: invariant violated');
        },
        opCall: function () {
            return other;
        }
    }); });
};
// The number type
var internalNumberType = factoryType(function (self) { return ({
    name: 'internal.NumberType',
    cTypeName: '#invalid#',
    genericApply: function (args) {
        var _a;
        if (args.length !== 1)
            abort('internal invariant violated');
        return ((_a = typeRegistry.get('internal.NumberType<' + args[0].name + '>')) !== null && _a !== void 0 ? _a : typeRegistry.set('internal.NumberType<' + args[0].name + '>', {
            name: 'internal.NumberType<' + args[0].name + '>',
            cTypeName: args[0].cTypeName,
            hasMember: function (s) {
                if (s == /* opAdd(number) */ "opAdd$12886f9d") {
                    return true;
                }
                abort('internal invariant violated');
            },
            getMemberGetterName: function (s) {
                abort('internal invariant violated');
            },
            memberType: function (s) {
                return add_number(args[0]);
            },
            genericApply: function (args) {
                abort('internal invariant violated');
            },
            opCall: function (a) {
                abort('internal invariant violated');
            }
        }),
            typeRegistry.get('internal.NumberType<' + args[0].name + '>'));
    },
    hasMember: function (s) {
        abort('internal invariant violated');
    },
    getMemberGetterName: function (s) {
        abort('internal invariant violated');
    },
    memberType: function (s) {
        abort('internal invariant violated');
    },
    opCall: function () {
        abort('internal invariant violated');
    }
}); });
// The number type
var number = factoryType(function (number) { return ({
    name: 'number',
    cTypeName: 'float',
    genericApply: function (args) {
        abort('Compiler error: invalid generic apply over `number`');
    },
    hasMember: function (s) {
        return (typeRegistry.has('internal.NumberType') &&
            typeRegistry.get('internal.NumberType').genericApply([number]).hasMember(s));
    },
    memberType: function (s) {
        return typeRegistry
            .get('internal.NumberType')
            .genericApply([number])
            .memberType(s);
    },
    getMemberGetterName: function (s) {
        return typeRegistry
            .get('internal.NumberType')
            .genericApply([number])
            .getMemberGetterName(s);
    },
    opCall: function () {
        abort('Cannot call number');
    }
}); });
// The void type
var voidty = factoryType(function (number) { return ({
    name: 'void',
    cTypeName: 'void',
    genericApply: function (args) {
        abort('Compiler error: invalid generic apply over `void`');
    },
    hasMember: function (s) {
        return false;
    },
    memberType: function (s) {
        abort('ICE: WTF?');
    },
    getMemberGetterName: function (s) {
        abort('ICE: WTF?');
    },
    opCall: function () {
        abort('ICE: WTF?');
    }
}); });
// The C `int` type
var cInt = factoryType(function (number) { return ({
    name: 'C.int',
    cTypeName: 'int',
    genericApply: function (args) {
        abort('Compiler error: invalid generic apply over `C.int`');
    },
    hasMember: function (s) {
        return (typeRegistry.has('internal.NumberType') &&
            typeRegistry.get('internal.NumberType').genericApply([number]).hasMember(s));
    },
    getMemberGetterName: function (s) {
        return typeRegistry
            .get('internal.NumberType')
            .genericApply([number])
            .getMemberGetterName(s);
    },
    memberType: function (s) {
        return typeRegistry
            .get('internal.NumberType')
            .genericApply([number])
            .memberType(s);
    },
    opCall: function () {
        abort('Cannot call C.int');
    }
}); });
function attr(t, n) {
    var p = attrs(t, n);
    if (p.length != 1)
        abort('Invalid attr ' + n + ' on ' + t.id);
    return p[0];
}
function attrs(t, n) {
    return t.args.filter(function (e) { return e.typeHint == n; }).map(function (e) { return e.argument; });
}
function child(t, n) {
    var p = children(t, n);
    if (p.length != 1)
        abort('Invalid childid ' + n + ' on ' + t.id + ' (has ' + p.length + ' expect 1)');
    return p[0];
}
function haschild(t, n) {
    var p = children(t, n);
    if (p.length > 1)
        abort('Invalid childid ' +
            n +
            ' on ' +
            t.id +
            ' (has ' +
            p.length +
            ' expect 0 or 1)');
    return !!p.length;
}
function children(t, n) {
    return t.children.filter(function (e) { return e.id == n; });
}
function expect(t, msg) {
    if (!t)
        abort('ICE: ' + msg);
    return t;
}
function validate(t, msg) {
    if (!t)
        abort('Error: ' + msg);
    return t;
}
var _a = (function () {
    var i = null;
    return {
        pushctx: function (newctx) {
            var o = i;
            i = newctx;
            return function () {
                i = o;
            };
        },
        ctx: function () {
            return expect(i, 'No context yet');
        }
    };
})(), pushctx = _a.pushctx, ctx = _a.ctx;
typeRegistry.set('number', number);
typeRegistry.set('void', voidty);
typeRegistry.set('C.int', cInt);
typeRegistry.set('internal.NumberType', internalNumberType);
function compile(n, p, istoplevel) {
    if (istoplevel === void 0) { istoplevel = false; }
    // PassPrevalidate
    if (p == Pass.PassPrevalidate && n.id == 'Function' && !istoplevel) {
        abort('Error: Function nesting is not allowed!');
    }
    if (p == Pass.PassPrevalidate && n.id == 'Function') {
        n.children.forEach(function (e) { return compile(e, p, false); });
        return CompilationResult('', '');
    }
    if (p == Pass.PassPrevalidate) {
        n.children.forEach(function (e) { return compile(e, p, istoplevel); });
        return CompilationResult('', '');
    }
    if (n.id == 'FunctionReturn' || n.id == 'FunctionArgument') {
        if (p == Pass.PassFunctionTypePropagation) {
            compile(n.children[0], p, istoplevel);
            n.args.push(parser_1.Argument('typeid', attr(n.children[0], 'typeid')));
            return CompilationResult();
        }
    }
    if (n.id == 'TypeIdent') {
        n.args.push(parser_1.Argument('typeid', attr(n, 'name')));
        return CompilationResult();
    }
    if (n.id == 'Function') {
        if (p == Pass.PassFunctionTypePropagation) {
            compile(child(child(n, 'FunctionArguments'), 'FunctionReturn'), p, istoplevel);
            children(child(n, 'FunctionArguments'), 'FunctionArgument').forEach(function (e) {
                return compile(e, p, istoplevel);
            });
            var argmap_1 = children(child(n, 'FunctionArguments'), 'FunctionArgument')
                .map(function (e) { return attr(e, 'typeid'); })
                .join('|||$$#$$|||');
            typeRegistry.set('#func:' + attr(n, 'name'), {
                name: '#func:' + attr(n, 'name'),
                cTypeName: '__func_' + attr(n, 'name'),
                hasMember: function () {
                    return false;
                },
                genericApply: function () {
                    abort('Invalid generic on #func:' + attr(n, 'name'));
                },
                getMemberGetterName: function () {
                    abort('ICE: getMemberGetterName called on #func:' + attr(n, 'name'));
                },
                memberType: function () {
                    abort('ICE: memberType called on #func:' + attr(n, 'name'));
                },
                opCall: function (isMemberCall, a) {
                    if (isMemberCall)
                        abort('Error: call type mismatch');
                    if (a.map(function (e) { return e.name; }).join('|||$$#$$|||') != argmap_1)
                        abort("Invalid call: " + attr(n, 'name') + "(" + a
                            .map(function (e) { return e.name; })
                            .join(', ') + ")");
                    return expect(typeRegistry.get(attr(child(child(n, 'FunctionArguments'), 'FunctionReturn'), 'typeid')), 'Function->FunctionReturn does not have a valid typeid');
                }
            });
            n.args.push(parser_1.Argument('typeid', '#func:' + attr(n, 'name')));
            return CompilationResult();
        }
        if (p == Pass.PassCompile) {
            return CompilationResult(typeRegistry.get(attr(child(child(n, 'FunctionArguments'), 'FunctionReturn'), 'typeid')).cTypeName + " __func_" + attr(n, 'name') + "(" + children(child(n, 'FunctionArguments'), 'FunctionArgument').map(function (e) {
                return expect(typeRegistry.get(attr(e, 'typeid')), "Function:FunctionArguments:FunctionArgument does not have a vaild typeid (it'ss " +
                    attr(e, 'typeid') +
                    ')').cTypeName + (" " + attr(e, 'name'));
            }) + ") {\n                    " + compile(n.children[1], p, false).code + "\n                    " + (typeRegistry.get(attr(child(child(n, 'FunctionArguments'), 'FunctionReturn'), 'typeid')).cTypeName == 'void'
                ? 'return;'
                : "/* (" + typeRegistry.get(attr(child(child(n, 'FunctionArguments'), 'FunctionReturn'), 'typeid')).cTypeName + ") todo: maybe this could be a call to an intrinsic, eg. internal.trap? */ __builtin_trap();") + "\n                }", '');
        }
        if (p == Pass.PassPreCompile) {
            return CompilationResult(typeRegistry.get(attr(child(child(n, 'FunctionArguments'), 'FunctionReturn'), 'typeid')).cTypeName + " __func_" + attr(n, 'name') + "(" + children(child(n, 'FunctionArguments'), 'FunctionArgument').map(function (e) {
                return expect(typeRegistry.get(attr(e, 'typeid')), "Function:FunctionArguments:FunctionArgument does not have a vaild typeid (it'ss " +
                    attr(e, 'typeid') +
                    ')').cTypeName + (" " + attr(e, 'name'));
            }) + ");", '');
        }
        if (p == Pass.PassValueTypePropagation) {
            var popctx = pushctx({
                returnType: attr(child(child(n, 'FunctionArguments'), 'FunctionReturn'), 'typeid'),
                locals: new Map(children(child(n, 'FunctionArguments'), 'FunctionArgument').map(function (e) { return [
                    attr(e, 'name'),
                    (expect(typeRegistry.get(attr(e, 'typeid')), 'broken typeid on argument!'),
                        attr(e, 'typeid'))
                ]; }))
            });
            compile(n.children[1], p, false);
            popctx();
            return CompilationResult();
        }
        abort('todo: ' + Pass[p]);
    }
    if (n.id == 'Call') {
        if (p == Pass.PassFunctionTypePropagation)
            return CompilationResult();
        if (p == Pass.PassPreCompile) {
            if (n.children[0].id == 'Variable' &&
                attr(n.children[0], 'name') == 'Global') {
                var target = attr(child(child(n, 'CallArgs'), 'Variable'), 'name');
                return CompilationResult("alias(\"" + target + "\");");
            }
        }
        if (p == Pass.PassValueTypePropagation) {
            if (n.children[0].id == 'Variable' && attr(n.children[0], 'name') == 'c') {
                n.children[2].children.forEach(function (e) { return compile(e, p, istoplevel); });
                var resultty = attr(child(n, 'GenericArguments').children[0], 'typeid');
                n.args.push(parser_1.Argument('typeid', resultty));
                for (var _i = 0, _a = child(n, 'CallArgs').children[1].children; _i < _a.length; _i++) {
                    var c = _a[_i];
                    compile(c.children[0], p, istoplevel);
                }
                return CompilationResult();
            }
            if (n.children[0].id == 'Variable' &&
                attr(n.children[0], 'name') == 'Global') {
                return CompilationResult();
            }
            compile(n.children[0], p, istoplevel);
            n.children[1].children.forEach(function (e) { return compile(e, p, istoplevel); });
            expect({
                // TODO: ADD ALL NODES HERE
                Variable: 1
            }[n.children[0].id], 'missing node from call member table, add it there: ' + n.children[0].id);
            // TODO: how to do this?
            if (n.children[0].id == 'MemberExpresison') {
                abort('todo');
            }
            else {
                var tgd = expect(typeRegistry.get(attr(n.children[0], 'typeid')), 'typeid was invalid');
                var typeOther = tgd.opCall(false, n.children[1].children.map(function (e) {
                    return expect(typeRegistry.get(attr(e, 'typeid')), 'broken typeid');
                }));
                n.args.push(parser_1.Argument('typeid', typeOther.name));
                return CompilationResult();
            }
        }
        if (p == Pass.PassCompile) {
            if (n.children[0].id == 'Variable' && attr(n.children[0], 'name') == 'c') {
                var cr_1 = CompilationResult();
                var resultty = attr(child(n, 'GenericArguments').children[0], 'typeid');
                var resultnm = expect(typeRegistry.get(resultty), 'broken typeid').cTypeName;
                var code = attr(child(n, 'CallArgs').children[0], 'str');
                for (var _b = 0, _c = child(n, 'CallArgs').children[1].children; _b < _c.length; _b++) {
                    var c = _c[_b];
                    code = code.replaceAll("{" + attr(c, 'name') + "}", Append(cr_1, compile(c.children[0], p, istoplevel)));
                }
                return CompilationResult("((" + resultnm + ")(" + code + "))");
            }
            var cr_2 = CompilationResult('', '');
            var args = child(n, 'CallArgs').children.map(function (e) {
                return Append(cr_2, compile(e, p, istoplevel));
            });
            if (n.children[0].id == 'Variable' &&
                attr(n.children[0], 'name') == 'Global') {
                return CompilationResult('', '');
            }
            // TODO: how to do this?
            if (n.children[0].id == 'MemberExpresison') {
                abort('todo');
            }
            else {
                var tgd = expect(typeRegistry.get(attr(n.children[0], 'typeid')), 'broken typeid');
                return CompilationResult(tgd.cTypeName + "(" + args.join(', ') + ")", cr_2.code);
            }
        }
    }
    if (n.id == 'BlockStatement') {
        if (p == Pass.PassCompile) {
            var cr_3 = CompilationResult();
            n.children.map(function (e) {
                // this looks super wtf, but you need this meme for it to work (because of order of operations)
                return (cr_3.code = [Append(cr_3, compile(e, p, istoplevel)) + ';', cr_3.code]
                    .reverse()
                    .join(''));
            });
            return cr_3;
        }
        if (p == Pass.PassValueTypePropagation) {
            n.children.forEach(function (e) { return compile(e, p, istoplevel); });
            return CompilationResult();
        }
    }
    if (n.id == 'ReturnStmt') {
        if (p == Pass.PassValueTypePropagation) {
            n.children.forEach(function (e) { return compile(e, p, istoplevel); });
            if (attr(n.children[0], 'typeid') != ctx().returnType)
                abort("Error: type '" + ctx().returnType + "' expected, but foumd " + attr(n.children[0], 'typeid'));
            return CompilationResult();
        }
        if (p == Pass.PassCompile) {
            var cr = compile(n.children[0], p, istoplevel);
            return CompilationResult('', cr.code + '\n' + 'return ' + cr.result + ';');
        }
    }
    if (n.id == 'NoopNode')
        return CompilationResult();
    if (n.id == 'AddOp') {
        if (p == Pass.PassValueTypePropagation) {
            n.children.forEach(function (e) { return compile(e, p, istoplevel); });
            var ltype = attr(n.children[0], 'typeid');
            var rtype = attr(n.children[1], 'typeid');
            var fn = 'opAdd$' + crypto_1.createHash('sha256').update(rtype).digest('hex').slice(0, 8);
            var tgd = expect(typeRegistry.get(ltype), 'typeid was invalid');
            if (tgd.hasMember(fn)) {
                var t = typeRegistry.get(rtype).memberType(fn);
                var typeOther = t.opCall(true, [
                    expect(typeRegistry.get(rtype), 'broken type: ' + rtype)
                ]);
                n.args.push(parser_1.Argument('typeid', typeOther.name));
                return CompilationResult();
            }
            else {
                abort('Unable to add: ' +
                    ltype +
                    ' and ' +
                    rtype +
                    ' (' +
                    fn +
                    ' not found)');
            }
        }
        if (p == Pass.PassCompile) {
            var cr_4 = CompilationResult();
            var _d = n.children.map(function (e) { return Append(cr_4, compile(e, p, istoplevel)); }), l = _d[0], r_1 = _d[1];
            var rtype = attr(n.children[1], 'typeid');
            var fn = 'opAdd$' + crypto_1.createHash('sha256').update(rtype).digest('hex').slice(0, 8);
            var t = typeRegistry.get(rtype).memberType(fn);
            return CompilationResult(t.cTypeName + "(" + l + ", " + r_1 + ")", cr_4.code);
        }
    }
    if (n.id == 'Variable') {
        if (p == Pass.PassValueTypePropagation) {
            if (typeRegistry.has('#func:' + attr(n, 'name'))) {
                n.args.push(parser_1.Argument('typeid', '#func:' + attr(n, 'name')));
            }
            else if (attr(n, 'name') == 'Global') {
                return CompilationResult();
            }
            else {
                n.args.push(parser_1.Argument('typeid', validate(ctx().locals.get(attr(n, 'name')), 'unknown local: ' + attr(n, 'name'))));
            }
            return CompilationResult();
        }
        if (p == Pass.PassCompile) {
            if (attr(n, 'name') == 'Global') {
                return CompilationResult();
            }
            else {
                return CompilationResult(attr(n, 'name'));
            }
        }
    }
    if (n.id == 'NumberConst') {
        if (attrs(n, 'typeid').length !== 1)
            n.args.push(parser_1.Argument('typeid', 'number'));
        return CompilationResult(attr(n, 'str'));
    }
    abort('TODO: ' + n.id + ' when performing ' + Pass[p]);
}
var r = CompilationResult('', '#include "leamscript.h"\n');
parser_1.parseResult.forEach(function (e) { return compile(e, Pass.PassPrevalidate, true); });
parser_1.parseResult.forEach(function (e) { return compile(e, Pass.PassFunctionTypePropagation, true); });
parser_1.parseResult.forEach(function (e) { return compile(e, Pass.PassValueTypePropagation, true); });
r.code += parser_1.parseResult
    .map(function (e) { return Append(r, compile(e, Pass.PassPreCompile, true)); })
    .join('\n');
r.code += parser_1.parseResult.map(function (e) { return Append(r, compile(e, Pass.PassCompile, true)); }).join('\n');
console.log(r.code);
