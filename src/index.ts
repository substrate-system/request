import { Implementation } from '@oddjs/odd/components/crypto/implementation'
import { SignedRequest, create as createMsg } from '@ssc-hermes/message'
import { KyInstance } from 'ky/distribution/types/ky'

// need to pass in starting sequence number
export function AuthRequest (
    ky:KyInstance,
    crypto:Implementation,
    startingSeq:number|Storage
):KyInstance {
    let seq:number = 0

    if (typeof startingSeq !== 'number') {  // is local storage
        const n = startingSeq.getItem('__seq')
        if (n) seq = parseInt(n)
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
