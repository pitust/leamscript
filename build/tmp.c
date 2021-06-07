#include "leamscript.h"
float __func_a(float arg);
void __func_main();
void __func_outputint(float i);
alias("main");
__thread const char *__parentfn = "<no parent>";
__thread const char *__currentfn = "<unknown>";
const char *__nextcaller(const char *name) {
  const char *a = __parentfn;
  __parentfn = __currentfn;
  __currentfn = name;
  return a;
}
void __prevcaller(const char *old) {
  __currentfn = __parentfn;
  __parentfn = old;
}
float __func_a(float arg) {
  const char *__pcall = __nextcaller("a");

  {
    float __retval = __runtimeAddInt(float)(arg, 1);
    __prevcaller(__pcall);
    return __retval;
  };
  /* (float) todo: maybe this could be a call to an intrinsic, eg.
   * internal.trap? */
  __builtin_trap();
}
void __func_main() {
  const char *__pcall = __nextcaller("main");
  __func_outputint(__func_a(68));
  __prevcaller(__pcall);
  return;
}
void __func_outputint(float i) {
  const char *__pcall = __nextcaller("outputint");
  ((int)(printf("%s(): %f\n", __parentfn, i)));
  __prevcaller(__pcall);
  return;
}
