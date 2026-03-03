/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
import "reflect-metadata"

import { readFileSync } from "fs"
import { NodeAdapterReedSolomon } from "@bnb-chain/reed-solomon/node.adapter"
import { expect, setDefaultTimeout, test } from "bun:test"

import { getMimeType } from "../util"

setDefaultTimeout(50000)
const fileName = __filename

test("test get mime type", async () => {
  expect(getMimeType(__filename)).toBe("application/javascript")
  expect(getMimeType("dist/test.pdf")).toBe("application/pdf")
})

test("test checksum", async () => {
  const fileBuffer = readFileSync(fileName)
  const rs = new NodeAdapterReedSolomon()
  const expectCheckSums = await rs.encodeInSubWorker(
    Uint8Array.from(fileBuffer)
  )
  expect(expectCheckSums[0]).not.toEqual(
    "47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU="
  )
})
