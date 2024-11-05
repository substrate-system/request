import {
    type SignedMessage as SignedMsg,
    create as createMsg,
    verify as msgVerify
} from '@bicycle-codes/message'
import type { KyInstance } from 'ky'
import { parseHeader, parseToken } from './parse.js'

export { parseHeader, parseToken }

/**
 * Create a `ky` that will add a signed Bearer token to each request.
 *
 * @param ky Ky library
 * @param {CryptoKeyPair} kepair The crypto keypair to use.
 * @param {number|Storage} startingSeq The number to start from, or a localstorage instance
 * @returns {KyInstance}
 */
export function SignedRequest (
    ky:KyInstance,
    keypair:CryptoKeyPair,
    startingSeq:number|Storage,
    opts?:Record<string, any>
):KyInstance {
    let seq:number = 0

    if (typeof startingSeq !== 'number') {  // is local storage
        const n = startingSeq.getItem('__seq')
        if (n) {
            try {
                seq = parseInt(n)
            } catch (_err) {
                seq = 0
            }
        }
    }

    return ky.create({
        hooks: {
            beforeRequest: [
                async req => {
                    // increment seq
                    // and save it in localstorage
                    seq++
                    if (
                        (typeof Storage !== 'undefined') &&
                        (startingSeq instanceof Storage)
                    ) {
                        startingSeq.setItem('__seq', String(seq))
                    }

                    req.headers.set('Authorization',
                        await createHeader(keypair, seq, opts))
                }
            ]
        }
    })
}

export type ParsedHeader = SignedMsg<{ seq:number }>

export function HeaderFactory (
    keypair:CryptoKeyPair,
    opts?:Record<string, any>,
    ls?:Storage
):()=>Promise<`Bearer ${string}`> {
    return function getHeader ():Promise<`Bearer ${string}`> {
        let seq = 0
        const storage = ls ?? window.localStorage
        const n = storage.getItem('__seq')

        if (n) {
            try {
                seq = parseInt(n)
            } catch (_err) {
                seq = 0
            }
        }

        seq++
        storage.setItem('__seq', String(seq))
        const header = createHeader(keypair, seq, opts)
        return header
    }
}

/**
 * Create tokens that are base64 encoded strings of a sequence number.
 * This is different than the header because this does not include 'Bearer '.
 */
export function TokenFactory (
    keypair:CryptoKeyPair,
    opts?:Record<string, any>,
    ls?:Storage
):()=>Promise<string> {
    return async function getToken ():Promise<string> {
        let seq = 0
        const storage = ls ?? window.localStorage
        const n = storage.getItem('__seq')
        if (n) {
            try {
                seq = parseInt(n)
            } catch (_err) {
                seq = 0
            }
        }

        seq++
        storage.setItem('__seq', String(seq))
        const token = await createToken(keypair, seq, opts)
        const encoded = btoa(JSON.stringify(token))
        return encoded
    }
}

export async function createHeader (
    // crypto:Implementation,
    keypair:CryptoKeyPair,
    seq:number,
    opts?:Record<string, any>,
):Promise<`Bearer ${string}`> {
    return encodeToken(await createToken(keypair, seq, opts))
}

export type Token<T> = SignedMsg<{
    seq:number,
} & {
    [K in keyof T]: T[K]
}>

export function encodeToken<T> (token:Token<T>):`Bearer ${string}` {
    const encoded = btoa(JSON.stringify(token))
    return `Bearer ${encoded}`
}

export function createToken (
    keypair:CryptoKeyPair,
    seq:number,
    opts?:Record<string, any>
):Promise<Token<typeof opts>> {
    if (!opts) return createMsg(keypair, { seq })
    return createMsg(keypair, { seq, ...opts })
}

export function verify (header:string, seq?:number):Promise<boolean> {
    try {
        const value = parseHeader(header)

        if (seq && seq <= value.seq) {
            return Promise.resolve(false)
        }

        return msgVerify(value)
    } catch (_err) {
        return Promise.resolve(false)
    }
}

export function verifyParsed (
    obj:ParsedHeader,
    seq?:number
):Promise<boolean> {
    if (seq && seq <= obj.seq) return Promise.resolve(false)
    return msgVerify(obj)
}
