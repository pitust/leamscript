# internals of LEAMScript
We have some builtin types, for example `number` and `C.int`. But how do they work?

## Number types
These are implemented in the compiler, `compiler.ts`. The types themselves are created like this:
```typescript
// The number type
const number: Type = factoryType(number => ({
    name: 'number',
    cTypeName: 'float',
/* snip */
    hasMember(s: string) {
        return (
            typeRegistry.has('internal.NumberType') &&
            typeRegistry.get('internal.NumberType').genericApply([number]).hasMember(s)
        )
    },
    getMemberGetterName(s: string) { /* similar proxying to internal.NumberType<number> */ }
}))
```

What does that do? It essentially maps number to the C type `float`, but otherwise maps itself to `internal.NumberType<number>`. That is then defined in `lib/internal.ts`:
<!-- TODO: we need to do this for real !-->
```typescript
@internal.ExportAs("internal.NumberType")
@internal.Repr('flat')
@internal.Stack('always')
@internal.Overloads
class NumberType<T> {
    inner: T;
    opAdd(other: number) {
        return c<T>('(({self}) + ({other}))', { self: this, other: other });
    }
    // snip: super similar declarations follow
}
```

First thing you may notice is the 4 lines of decorators at the start. This is pretty typical of internal code actually, as we use a ton of compiler plugins. Refer to [Decorators] for more info on those





## Decorators
### `internal.ExportAs`
This decorator merely renames the target without unexporting it, in order to implement globals (normal globals use # to prevent being set in the global scope, however `internal.ExportAs` makes them fully visible).
### `internal.Repr`
This is a private (and more powerful) version of the `@repr` decorator. It sets the representation of the target. The nuances are:
 - `@repr` will (unless used with `@repr('heap')`) force the value to be placed on the stack. Not so with `@internal.Repr`.
 - `@repr` does **not** affect the actual type layout (so however hard you try, this will **always** be a struct or a struct pointer).
