# request
![tests](https://github.com/bicycle-codes/request/actions/workflows/nodejs.yml/badge.svg)
[![Socket Badge](https://socket.dev/api/badge/npm/package/@bicycle-codes/request)](https://socket.dev/npm/package/@bicycle-codes/request)
[![module](https://img.shields.io/badge/module-ESM%2FCJS-blue?style=flat-square)](README.md)
![types](https://img.shields.io/npm/types/@bicycle-codes/request?style=flat-square)
[![semantic versioning](https://img.shields.io/badge/semver-2.0.0-blue?logo=semver&style=flat-square)](https://semver.org/)
[![install size](https://flat.badgen.net/packagephobia/install/@bicycle-codes/request)](https://packagephobia.com/result?p=@bicycle-codes/request)
![license](https://img.shields.io/badge/license-MIT-brightgreen?style=flat-square)

Use a `Bearer` token in an HTTP request to verify identity. This will sign an integer with the given [odd instance](https://github.com/oddsdk/ts-odd/blob/main/src/components/crypto/implementation.ts#L14), suitable for an access-control type of auth.

The sequence number is an always incrementing integer. It is expected that a server would remember the previous sequence number for this DID (public key), and check that the given sequence is larger than the previous sequence. Also it would check that the signature is valid.

You can pass in either an integer or a localStorage instance. If you pass a localStorage instance, it will read the index `'__seq'`, which should be a number. If there is not a number stored there, we will start at `0`.

## contents

<!-- toc -->

- [install](#install)
- [globals](#globals)
- [example](#example)
  * [clientside](#clientside)
  * [serverside](#serverside)
- [dependencies](#dependencies)
- [API](#api)
  * [SignedRequest](#signedrequest)
  * [HeaderFactory](#headerfactory)
  * [createHeader](#createheader)
  * [verify](#verify)
  * [verifyParsed](#verifyparsed)
  * [createToken](#createtoken)
  * [encodeToken](#encodetoken)
- [more examples](#more-examples)
  * [create an instance](#create-an-instance)
  * [verify a token](#verify-a-token)
  * [parse a token](#parse-a-token)
  * [use localStorage for the sequence number](#use-localstorage-for-the-sequence-number)

<!-- tocstop -->

## install
```
npm i -S @bicycle-codes/request
```

## globals
This reads and writes to `__seq` key in `localStorage`.

## example
Create a new `ky` instance that will add a signed header to every request,
and set the latest sequence number in `localStorage`.

### clientside
```js
import { program as createProgram } from '@oddjs/odd'
import { SignedRequest } from '@bicycle-codes/request'
import ky from 'ky'

// ...get a `program` from `odd`

const crypto = program.components.crypto

// we read and write to '__seq' key in `localStorage`
const request = SignedRequest(ky, crypto, winodw.localStorage)
// `request` is an extended version of `ky`
const response = await request.get('https://example.com')
// request is sent with headers `{ Authorization: Bearer <credentials> }`
```

### serverside
Parse the header string, and check the sequence number

```ts
import {
    verifyParsed,
    parseHeader
} from '@bicycle-codes/request'
import type { ParsedHeader } from '@bicycle-codes/request'

const headerString = request.headers.Authorization
const parsedHeader:ParsedHeader = parseHeader(headerString)
const { seq } = parsedHeader
// ...get the previous sequence number somehow...
const isOk = await verifyParsed(parsedHeader)   // check signature
const isSequenceOk = (seq > lastSequence)  // check sequence number
```

Or, pass in a sequence number to check that `header.seq` is greater than

```js
const headerString = request.headers.Authorization
const parsedHeader = parseHeader(headerString)
const isOk = await verifyParsed(parsedHeader, 3)  // <-- pass in a seq here
```

-------


## dependencies
This should be ergonomic to use with the existing [odd crypto library](https://github.com/oddsdk/ts-odd).

We also depend the library [ky](https://github.com/sindresorhus/ky) for requests. 

-------

## API
Exported functions:

----------------------------------
### SignedRequest
----------------------------------
Patch a `ky` instance so it makes all requests with a signed header.

```ts
import { KyInstance } from 'ky/distribution/types/ky'

function SignedRequest (
    ky:KyInstance,
    crypto:Implementation,
    startingSeq:number|Storage
):KyInstance
```

The request will have an `Authorization` header, base64 encoded:
```js
request.headers.get('Authorization')
// => "Bearer eyJzZXEiOjEsIm..."
```

#### example
```js
import ky from 'ky-universal'
import { program as createProgram } from '@oddjs/odd'
import { SignedRequest, } from '@bicycle-codes/request'

const program = await createProgram({
    namespace: { creator: 'identity', name: 'example' }
})
const { crypto } = program.components

// `req` is an instance of `ky`
const req = SignedRequest(ky, crypto, 0)

// make a request
await req.get('https://example.com/')

// ... later, on the server ...
const headerObject = parseHeader(request.headers.get('Authorization'))

// => {
//     seq: 1,
//     author: 'did:key:z13V3Sog2YaUKh...
//     signature: 'VyaxQayQdXU7qhcOfcsCq...
// }
```

-----------------------------------------------------------
### HeaderFactory
-----------------------------------------------------------
Create a function that will create header tokens and read and write the sequence number from `localStorage`.

```ts
function HeaderFactory (
    crypto:Implementation,
    opts?:Record<string, any>,
    ls?:Storage
):()=>Promise<`Bearer ${string}`>
```

#### example
```ts
import { program as createProgram } from '@oddjs/odd'
import { HeaderFactory } from '@bicycle-codes/request'

const program = await createProgram(
    namespace: { creator: 'test', name: 'testing' },
})
const { crypto } = program.components

const createHeader = HeaderFactory(crypto)
const header = await createHeader()  // read & update `__seq` in localStorage

/**
 * Optionally can pass in a params object and
 * a localStorage instance
 */
const createHeaderTwo = HeaderFactory(crypto, { test: 'param' }, localStorage)
```

-----------------------------------------------------------
### createHeader
-----------------------------------------------------------
Create the base64 encoded header string

```ts
import { Implementation } from '@oddjs/odd/components/crypto/implementation'
async function createHeader (crypto:Implementation, seq:number)
```

This will create a header that looks like this:
```js
`Bearer eyJzZXEiOj...`
```

-----------------------------------------------------------
### verify
-----------------------------------------------------------
Check that the signature matches the given public key. Optionally takes a sequence number, and will return false if the header's sequence is not greater than the given sequence.

```ts
// take a base64 encoded header string
function verify (header:string, seq?:number):Promise<boolean>
```

#### example
```js
import { verify } from '@bicycle-codes/request'

const isOk = await verify(header)
```

-----------------------------------------------------------
### verifyParsed
-----------------------------------------------------------
Check the validity of a parsed token. Optionally takes a sequence number. If a `seq` number is not passed in, then this will only verify the signature.

```ts
import { SignedRequest as SignedMsg } from '@bicycle-codes/message'
// take a parsed token
function verifyParsed (
    msg:SignedMsg<{ seq:number }>,
    seq?:number
):Promise<boolean>
```

#### example
```ts
import { verifyParsed, create as createToken } from '@bicycle-codes/request'

const token = await createToken(crypto, 1)
const isOk = await verifyParsed(parsedToken)
```

-----------------------------------------------------------
### createToken
-----------------------------------------------------------
Create a token object. This is the value that is encoded to make a header.

```ts
function createToken (
    crypto:Implementation,
    seq:number,
    opts?:Record<string, any>
):Promise<Token<typeof opts>>
```

#### example
You can pass additional arguments to `createToken`, which will be added to the signed token object.

```ts
import { createToken } from '@bicycle-codes/request'

const token = await createToken(crypto, 1, { example: 'testing' })
t.equal(token.example, 'testing', 'should have an additional property')
```

-----------------------------------------------------------
### encodeToken
-----------------------------------------------------------
Encode a token object as a base64 string

```ts
function encodeToken<T> (token:Token<T>):`Bearer ${string}`
```

#### example
```js
import { encodeToken } from '@bicycle-codes/request'
const encoded = encodeToken(token)
```

-------

## more examples

### create an instance
In a web browser, pass an instance of [ky](https://github.com/sindresorhus/ky), and return an extended instance of `ky`, that will automatically add a signature to the header as a `Bearer` token.

The header is a base64 encoded Bearer token. It looks like
```
Bearer eyJzZXEiOjE...
```

```ts
import { test } from '@nichoth/tapzero'
import { AuthRequest, parseHeader, verify } from '@bicycle-codes/request'
import ky from 'ky-universal'

let header:string
// header is a base64 encoded string: `Bearer ${base64string}`

test('create instance', async t => {
    // `crypto` here is from `odd` -- `program.components.crypto`
    const req = AuthRequest(ky, crypto, 0)

    await req.get('https://example.com/', {
        hooks: {
            afterResponse: [
                (request:Request) => {
                    header = request.headers.get('Authorization')
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
```

### verify a token
Check if a given signature matches the given public key. You would probably call this in server-side code. This only checks that the public key and signature are ok together. In real life you would need to check that the public key is something valid in your system as well as calling `verify` here.

```ts
test('parse header', t => {
    const obj = parseHeader(header)  // first parse base64, then parse JSON
    // {
    //      seq: 1,
    //      author: 'did:key:...',
    //      signature: '123abc'
    //}
    t.equal(obj.seq, 1, 'should have the right sequence number')
})

test('verify the header', async t => {
    t.equal(await verify(header), true, 'should validate a valid token')
    // also make sure that the sequence number is greater than the previous
})
```

### parse a token
This is distinct from parsing a "header" because the token does not include the text "Bearer".

```ts
import { TokenFactory, parseToken, verifyParsed } from '@bicycle-codes/request'

test('token factory', async t => {
    // this is client-side
    const createToken = TokenFactory(crypto)
    const token = await createToken()
    t.ok(!token.includes('Bearer'),
        'should not include "Bearer" text in the token')

    // this is server-side
    const parsedToken = parseToken(token)
    t.equal(parsedToken.seq, 1, 'should include the first sequence number')
    t.ok(parsedToken.author, 'should have "author" in the token')
    t.ok(parsedToken.signature, 'should have "signature" in the token')

    t.ok(verifyParsed(parsedToken), 'should verify a valid token')
    // also, check that the `parsedToken.seq` has increased
})
```

### use localStorage for the sequence number
Pass in an instance of `localStorage`, and we will save the sequence number to `__seq` on any request.

```ts
import { test } from '@nichoth/tapzero'
import { assemble } from '@oddjs/odd'
import { components } from '@ssc-hermes/node-components'
import ky from 'ky-universal'
import { LocalStorage } from 'node-localstorage'
import { SignedRequest, parseHeader } from '@bicycle-codes/request'

test('create an instance with localStorage', async t => {
    const program = await assemble({
        namespace: { creator: 'test', name: 'testing' },
        debug: false
    }, components)
    const crypto = program.components.crypto

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
```
