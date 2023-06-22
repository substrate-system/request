import { Implementation } from '@oddjs/odd/components/crypto/implementation'
import { SignedRequest, create as createMsg } from '@ssc-hermes/message'
import { KyInstance } from 'ky/distribution/types/ky'

// need to pass in starting sequence number
export function AuthRequest (
    ky:KyInstance,
    crypto:Implementation,
    startingSeq:number|Storage
):KyInstance {
    return ky.create({
        hooks: {
            beforeRequest: [
                async req => {
                    const seq = typeof startingSeq === 'number' ?
                        startingSeq :
                        1
                    req.headers.set('Authorization',
                        await createHeader(crypto, seq))
                }
            ]
        }
    })
}

export async function createHeader (crypto:Implementation, seq:number)
:Promise<string> {
    const newHeader = JSON.stringify(await createMsg(crypto, { seq }))
    return `Bearer ${newHeader}`
}

/**
 * Take the header returned from `createHeader`
 */
export function parseHeader (header:string):SignedRequest<{ seq:number }> {
    const json = header.split(' ')[1]
    return JSON.parse(json)
}
