import type { Token } from './index.js'

/**
 * Take the header returned from `createHeader`
 * @returns A parsed JSON value (an object)
 */
export function parseHeader<T> (header:string):Token<T> {
    const json = atob(header.split(' ')[1])
    const obj = JSON.parse(json)
    if (typeof obj.seq === 'string') obj.seq = parseInt(obj.seq)
    return obj
}

export function parseToken<T> (token:string):Token<T> {
    const json = atob(token)
    return JSON.parse(json)
}
