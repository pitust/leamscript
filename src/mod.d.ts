declare function noteCall(s: string): void;
declare function c<T>(s: string, embed?: Record<string, any>): T;
declare function Global<T>(t: T): T;
declare namespace C {
    type int = number;
}