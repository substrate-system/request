import { Implementation } from '@oddjs/odd/components/crypto/implementation'
import {
    SignedRequest,
    create as createMsg,
    verify as msgVerify
} from '@ssc-half-light/message'
import { KyInstance } from 'ky/distribution/types/ky'

/**
 * Create a `ky` that will add a signed Bearer token to each request.
 * @param ky Ky library
 * @param {Implementation} crypto The crypto object from odd
 * @param startingSeq The number to start from, or a localstorage instance
 * @returns {KyInstance}
 */
export function AuthRequest (
    ky:KyInstance,
    crypto:Implementation,
    startingSeq:number|Storage
):KyInstance {
    let seq:number = 0

    if (typeof startingSeq !== 'number') {  // is local storage
        const n = startingSeq.getItem('__seq')
        if (n) {
            try {
                seq = parseInt(n)
            } catch (err) {
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
                        await createHeader(crypto, seq))
                }
            ]
        }
    })
}

export async function createHeader (crypto:Implementation, seq:number)
:Promise<string> {
    const newToken = btoa(JSON.stringify(await createMsg(crypto, { seq })))
    return `Bearer ${newToken}`
}

/**
 * Take the header returned from `createHeader`
 * @returns A parsed JSON value (an object)
 */
export function parseHeader (header:string):SignedRequest<{ seq:number }> {
    const json = atob(header.split(' ')[1])
    return JSON.parse(json)
}

export function verify (header:string):Promise<boolean> {
    const value = parseHeader(header)
    return msgVerify(value)
}

export function verifyParsed (obj:SignedRequest<{ seq:number }>):Promise<boolean> {
    return msgVerify(obj)
}
