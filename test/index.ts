import { test } from '@socketsupply/tapzero'
import { assemble } from '@oddjs/odd'
import { components } from '@ssc-hermes/node-components'
import ky from 'ky-universal'
import { LocalStorage } from 'node-localstorage'
import {
    SignedRequest,
    createHeader,
    parseHeader,
    verify,
    verifyParsed
} from '../dist/index.js'

// for localStorage test
globalThis.Storage = LocalStorage

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
    t.ok(header.includes('Bearer '), 'should include the word "bearer"')
})

test('parse header', t => {
    const obj = parseHeader(header)
    t.equal(obj.seq, 1, 'should have the right sequence number')
    t.ok(obj.author.includes('did:key'),
        'should have the writer DID as "author" key')
    t.equal(typeof obj.signature, 'string', 'should have a signature')
})

let req
test('create instance', async t => {
    req = SignedRequest(ky, crypto, 0)

    await req.get('https://example.com/', {
        hooks: {
            afterResponse: [
                (request:Request) => {
                    const obj = parseHeader(
                        request.headers.get('Authorization') as string
                    )
                    t.ok(obj, 'should have an Authorization header in request')
                    t.equal(obj.seq, 1, 'should have the right sequence')
                }
            ]
        }
    })
})

let parsedToken
test('make another request', async t => {
    await req.get('https://example.com', {
        hooks: {
            afterResponse: [
                (request:Request) => {
                    const obj = parsedToken = parseHeader(
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

test('verify an invalid token', async t => {
    t.equal(await verify('Bearer balnoey'), false,
        'should not validate an invalid token')
})

test('create an instance with localStorage', async t => {
    const localStorage = new LocalStorage('./test-storage')
    localStorage.setItem('__seq', 3)
    const req = SignedRequest(ky, crypto, localStorage)

    await req.get('https://example.com', {
        hooks: {
            afterResponse: [
                (request:Request) => {
                    const obj = parseHeader(
                        request.headers.get('Authorization') as string
                    )
                    t.equal(obj.seq, 4,
                        'should use localStorage to create the sequence')
                }
            ]
        }
    })

    const seq = localStorage.getItem('__seq')
    t.equal(seq, 4, 'should save the sequence number to localStorage')
})

test('verify a parsed token', async t => {
    const isOk = verifyParsed(parsedToken)
    t.ok(isOk, 'should verify a valid parsed token')
})
