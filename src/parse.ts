import type { Token } from './index.js'

/**
 * Take the header returned from `createHeader`
 * @returns A parsed JSON value (an object)
 */
export function parseHeader<T> (header:string):Token<T> {
    const json = atob(header.split(' ')[1])
    return JSON.parse(json)
}
