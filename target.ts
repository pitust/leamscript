function a(arg: number): number {
    return arg + 1
}

function main() {
    outputint(a(68))
}
function outputint(i: number) {
    c<C.int>('printf("%s(): %f\\n", {caller}, {arg})', {
        arg: i,
        caller: nplugin.dev.pitust.leamscript.callermixin.caller()
    })
}
Global(main)
