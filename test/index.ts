import { test } from '@nichoth/tapzero'
import { assemble } from '@oddjs/odd'
import { components } from '@ssc-hermes/node-components'
import ky from 'ky-universal'
import { LocalStorage } from 'node-localstorage'
import {
    SignedRequest,
    createToken,
    createHeader,
    parseHeader,
    verify,
    encodeToken,
    verifyParsed,
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

let token:Awaited<ReturnType<typeof createToken>>
test('create a token', async t => {
    token = await createToken(crypto, 1)

    t.ok(token.author.includes('did:key:'), 'should have "author" field')
    t.ok(token.signature, 'should have a signature')
    t.equal(token.seq, 1, 'should have a sequence number')
})

test('verify the token', async t => {
    t.ok(verifyParsed(token), 'should verify a valid token')
})

test('create a token with additional properties', async t => {
    const token = await createToken(crypto, 1, { example: 'testing' })
    t.equal(token.example, 'testing', 'should have an additional property')
})

test('base64 encode the token', t => {
    const encoded = encodeToken(token)
    t.equal(typeof encoded, 'string', 'should return a base64 string')
})

let header:string
test('create a header', async t => {
    header = await createHeader(crypto, 1)
    console.log('header...', header)
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
    t.equal(await verify(header, 1), false,
        'should check the `seq` number if we pass it')
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
    const isOk = await verifyParsed(parsedToken)
    t.ok(isOk, 'should verify a valid parsed token')
})

test('create an instance with additional params', async t => {
    const opts = { username: 'alice' }
    const req = SignedRequest(ky, crypto, 0, opts)

    await req.get('https://example.com/', {
        hooks: {
            afterResponse: [
                (request:Request) => {
                    const obj = parseHeader<typeof opts>(
                        request.headers.get('Authorization') as string
                    )
                    t.ok(obj, 'should have an Authorization header in request')
                    t.equal(obj.seq, 1, 'should have the right sequence')
                    t.equal(obj.username, 'alice',
                        'should have additional properties')
                    t.ok(verifyParsed(obj), 'should validate a valid token')
                }
            ]
        }
    })
})
