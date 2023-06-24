import { test } from '@socketsupply/tapzero'
import { assemble } from '@oddjs/odd'
import { components } from '@ssc-hermes/node-components'
import { AuthRequest, createHeader, parseHeader, verify } from '../dist/index.js'
import ky from 'ky-universal'

let crypto
test('setup', async t => {
    const program = await assemble({
        namespace: { creator: 'test', name: 'testing' },
        debug: false
    }, components)
    crypto = program.components.crypto

    t.ok(program, 'create a program')
})

let header:string
test('create a header', async t => {
    header = await createHeader(crypto, 1)
    t.ok(header, 'should return a header')
})

test('parse header', t => {
    const obj = parseHeader(header)
    t.equal(obj.seq, 1, 'should have the right sequence number')
})

let req
test('create instance', async t => {
    req = AuthRequest(ky, crypto, 0)

    await req.get('https://example.com/', {
        hooks: {
            afterResponse: [
                (request:Request) => {
                    const obj = parseHeader(
                        request.headers.get('Authorization') as string
                    )
                    t.equal(obj.seq, 1, 'should have the right sequence')
                }
            ]
        }
    })
})

test('make another request', async t => {
    await req.get('https://example.com', {
        hooks: {
            afterResponse: [
                (request:Request) => {
                    const obj = parseHeader(
                        request.headers.get('Authorization') as string
                    )
                    t.equal(obj.seq, 2, 'should increment the sequence number')
                }
            ]
        }
    })
})

test('verify the header', async t => {
    t.equal(await verify(header), true, 'should validate a valid token')
})
