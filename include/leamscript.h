#include <stdio.h>
#define __runtimeAddIntInternal_float(a, b) (float)((a) + (b))
#define __runtimeAddInt(ty) __runtimeAddIntInternal_ ## ty

#ifdef __arm64__
#define alias(to) asm(".global _" to "\n_" to ":b _" "__func_" to)
#else
#error unsupported architercture
#endif