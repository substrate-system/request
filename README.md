# request ![tests](https://github.com/ssc-half-light/request/actions/workflows/nodejs.yml/badge.svg)

Use a `Bearer` token in an HTTP request to verify identity. This will sign an integer with the given [odd instance](https://github.com/oddsdk/ts-odd/blob/main/src/components/crypto/implementation.ts#L14), suitable for an access-control type of auth.

The sequence number is an always incrementing integer. It is expected that a server would remember the previous sequence number for this DID (public key), and check that the given sequence is larger than the previous sequence. Also it would check that the signature is valid.

You can pass in either an integer or a localStorage instance. If you pass a localStorage instance, it will read the index `'__seq'`, which should be a number. If there is not a number stored there, we will start at `0`.

## install
```
npm i -S @ssc-half-light/request
```

## example
Create a new `ky` instance that will add a signed header to every request,
and set the latest sequence number in `localStorage`.

__clientside__
```js
import { SignedRequest } from '@ssc-half-light/request'
import ky from 'ky'

// ...get a `program` from `odd`
const crypto = program.components.crypto

const request = SignedRequest(ky, crypto, winodw.localStorage)
const response = await request.get('https://example.com')
// request is sent with headers `{ Authorization: Bearer <credentials> }`
```

__Serverside__, you would want to check the signature, and that the sequence
number is larger than the previous one.
```js
import {
    verifyParsed,
    parseHeader
} from '@ssc-half-light/request'

const headerString = request.headers.Authorization
const parsedHeader = parseHeader(headerString)
const { seq } = parsedHeader
// ...get the previous sequence number somehow...
const isOk = await verifyParsed()   // check signature
const isSequenceOk = (seq > lastSequence)  // check sequence number
```

-------


## dependencies
This should be ergonomic to use with the existing [odd crypto library](https://github.com/oddsdk/ts-odd).

We also depend the library [ky](https://github.com/sindresorhus/ky) for requests. 

-------

## API
Exported functions:

### SignedRequest
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

### createHeader
Create the base64 encoded header string

```ts
import { Implementation } from '@oddjs/odd/components/crypto/implementation'
async function createHeader (crypto:Implementation, seq:number)
```

This will return a header that looks like this:
```js
{
    seq: 1,
    author:  'did:key:z13...'
    signature:  'YIXITjTX7K4...'
}
```

### verify
Check that the signature matches the given public key.

```ts
function verify (header:string):Promise<boolean>
```

### verifyParsed
Check the validity of a parsed token

```ts
import { SignedRequest as SignedMsg } from '@ssc-half-light/message'
function verifyParsed (obj:SignedMsg<{ seq:number }>):Promise<boolean>
```

## more examples

### create an instance
In a web browser, pass an instance of [ky](https://github.com/sindresorhus/ky), and return an extended instance of `ky`, that will automatically add a signature to the header as a `Bearer` token.

The header is a base64 encoded Bearer token. It looks like
```
Bearer eyJzZXEiOjE...
```

```ts
import { test } from '@socketsupply/tapzero'
import { AuthRequest, parseHeader, verify } from '@ssc-half-light/request'
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

### use localStorage for the sequence number
Pass in an instance of `localStorage`, and we will save the sequence number to `__seq` on any request.

```ts
import { test } from '@socketsupply/tapzero'
import { assemble } from '@oddjs/odd'
import { components } from '@ssc-hermes/node-components'
import ky from 'ky-universal'
import { LocalStorage } from 'node-localstorage'
import { AuthRequest, parseHeader } from '@ssc-half-light/request'

test('create an instance with localStorage', async t => {
    const program = await assemble({
        namespace: { creator: 'test', name: 'testing' },
        debug: false
    }, components)
    const crypto = program.components.crypto

    const localStorage = new LocalStorage('./test-storage')
    localStorage.setItem('__seq', 3)
    const req = AuthRequest(ky, crypto, localStorage)

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
 
