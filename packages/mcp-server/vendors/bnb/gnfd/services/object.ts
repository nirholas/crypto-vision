/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import {
  existsSync,
  fstatSync,
  readFileSync,
  statSync,
  writeFileSync
} from "fs"
import path from "path"
import {
  bytesFromBase64,
  Long,
  RedundancyType,
  VisibilityType
} from "@bnb-chain/greenfield-js-sdk"
import { ObjectInfo } from "@bnb-chain/greenfield-js-sdk/dist/esm/types/sp/Common"
import { NodeAdapterReedSolomon } from "@bnb-chain/reed-solomon/node.adapter"
import type { Hex } from "viem"

import Logger from "@/utils/logger"
import { getMimeType, response, type ApiResponse } from "../util"
import { getAccount } from "./account"
import { createBucket } from "./bucket"
import { getClient } from "./client"
import { executeTransaction } from "./common"
import { selectSp } from "./sp"

// Define file response type
interface FileData {
  bucketName: string
  objectName: string
}

/**
 * Create a file object
 */
const createFileObject = (filePath: string) => {
  const stats = statSync(filePath)
  const fileSize = stats.size
  const fileType = getMimeType(filePath) || "unknown"

  return {
    name: path.basename(filePath),
    type: fileType,
    size: fileSize,
    content: readFileSync(filePath)
  }
}

/**
 * Create a file in Greenfield
 */
export const createFile = async (
  network: "testnet" | "mainnet",
  {
    privateKey,
    filePath,
    bucketName
  }: {
    privateKey: Hex
    filePath: string
    bucketName?: string
  }
): Promise<ApiResponse<FileData>> => {
  try {
    // Ensure the file exists
    const objectName = path.basename(filePath)
    const fileObj = createFileObject(filePath)
    if (fileObj.size > 1024 * 1024 * 1024) {
      return response.fail("File size must be less than 1GB")
    }

    const rs = new NodeAdapterReedSolomon()
    const expectCheckSums = await rs.encodeInSubWorker(
      Uint8Array.from(fileObj.content)
    )

    Logger.debug(
      `File info: ${filePath}, size: ${fileObj.size} bytes, type: ${fileObj.type}, expectCheckSums: ${expectCheckSums}`
    )

    // Get or create bucket
    const bucketNameRes = await createBucket(network, {
      privateKey,
      bucketName
    })
    if (bucketNameRes.status === "error") {
      return response.fail(
        bucketNameRes.message || "Unknown bucket creation error"
      )
    }
    const _bucketName = bucketNameRes.data!.bucketName

    Logger.debug(`Using bucket: ${_bucketName}, for object: ${objectName}`)

    // Get client and account
    const client = getClient(network)
    const account = await getAccount(network, privateKey)

    // Create object transaction
    const createObjectTx = await client.object.createObject({
      bucketName: _bucketName,
      objectName: objectName,
      creator: account.address,
      visibility: VisibilityType.VISIBILITY_TYPE_PRIVATE,
      contentType: fileObj.type as string,
      redundancyType: RedundancyType.REDUNDANCY_EC_TYPE,
      payloadSize: Long.fromInt(fileObj.content.byteLength),
      expectChecksums: expectCheckSums.map((x) => bytesFromBase64(x))
    })

    Logger.debug(`Created object transaction for file: ${objectName}`)

    // Execute transaction
    const txResult = await executeTransaction<void>(
      createObjectTx,
      account,
      privateKey,
      "Create object",
      `${objectName} in bucket ${_bucketName}`
    )

    if (txResult.status !== "success") {
      return response.fail(`Failed to create object: ${txResult.message}`)
    }

    // Upload file content
    const uploadRes = await client.object.uploadObject(
      {
        bucketName: _bucketName,
        objectName: objectName,
        body: fileObj,
        txnHash: txResult.txHash || ""
      },
      {
        type: "ECDSA",
        privateKey: privateKey
      }
    )

    Logger.debug(`Upload result: ${JSON.stringify(uploadRes)}`)

    if (uploadRes.code === 0) {
      return response.success({
        bucketName: _bucketName,
        objectName
      })
    } else {
      return response.fail(`Create file failed: ${JSON.stringify(uploadRes)}`)
    }
  } catch (error) {
    Logger.error(`Create file operation failed: ${error}`)
    return response.fail(`Create file operation failed: ${error}`)
  }
}

/**
 * Create folder in Greenfield
 */
export const createFolder = async (
  network: "testnet" | "mainnet",
  {
    privateKey,
    folderName,
    bucketName
  }: {
    privateKey: Hex
    folderName?: string
    bucketName?: string
  }
): Promise<ApiResponse<{ bucketName: string; folderName: string }>> => {
  try {
    const _folderName = folderName || "created-by-universal-crypto-mcp"

    // Get or create bucket
    const bucketNameRes = await createBucket(network, {
      privateKey,
      bucketName
    })
    if (bucketNameRes.status === "error") {
      return response.fail(
        bucketNameRes.message || "Unknown bucket creation error"
      )
    }
    const _bucketName = bucketNameRes.data!.bucketName

    // Get client and account
    const client = getClient(network)
    const account = await getAccount(network, privateKey)

    // Ensure folder name ends with a slash
    const formattedFolderName = _folderName.endsWith("/")
      ? _folderName
      : `${_folderName}/`

    // Create folder transaction
    const createObjectTx = await client.object.createFolder({
      bucketName: _bucketName,
      objectName: formattedFolderName,
      creator: account.address,
      visibility: VisibilityType.VISIBILITY_TYPE_PRIVATE,
      redundancyType: RedundancyType.REDUNDANCY_EC_TYPE
    })

    // Execute transaction
    const txResult = await executeTransaction<void>(
      createObjectTx,
      account,
      privateKey,
      "Create folder",
      `${formattedFolderName} in bucket ${_bucketName}`
    )

    // If successful, return folder information
    if (txResult.status === "success") {
      return response.success({
        bucketName: _bucketName,
        folderName: formattedFolderName
      })
    }

    // If transaction failed, return the error
    return response.fail(txResult.message || "Unknown create folder error")
  } catch (error) {
    Logger.error(`Create folder operation failed: ${error}`)
    return response.fail(`Create folder operation failed: ${error}`)
  }
}

export const getObjectInfo = async (
  network: "testnet" | "mainnet",
  {
    bucketName,
    objectName
  }: {
    bucketName: string
    objectName: string
  }
): Promise<ApiResponse<ObjectInfo>> => {
  try {
    const client = getClient(network)
    const res = await client.object.headObject(bucketName, objectName)

    return response.success(res.objectInfo as {} as ObjectInfo)
  } catch (error) {
    Logger.error(`Get object info operation failed: ${error}`)
    return response.fail(`Get object info operation failed: ${error}`)
  }
}

/**
 * Delete an object in Greenfield
 */
export const deleteObject = async (
  network: "testnet" | "mainnet",
  {
    privateKey,
    bucketName,
    objectName
  }: {
    privateKey: Hex
    bucketName: string
    objectName: string
  }
): Promise<ApiResponse<void>> => {
  try {
    const client = getClient(network)
    const account = await getAccount(network, privateKey)

    // Check if object exists first
    try {
      await client.object.headObject(bucketName, objectName)
    } catch (error) {
      Logger.error(
        `Object ${objectName} does not exist in bucket ${bucketName}`
      )
      return response.fail(
        `Object ${objectName} does not exist in bucket ${bucketName}`
      )
    }

    // Create delete transaction
    const tx = await client.object.deleteObject({
      bucketName,
      objectName,
      operator: account.address
    })

    const txResult = await executeTransaction<void>(
      tx,
      account,
      privateKey,
      "Delete object",
      `${objectName} from bucket ${bucketName}`
    )

    // Simply return the transaction result
    return txResult
  } catch (error) {
    Logger.error(`Delete object operation failed: ${error}`)
    return response.fail(`Delete object operation failed: ${error}`)
  }
}

/**
 * List objects in a bucket in Greenfield
 * @param network Greenfield network (testnet or mainnet)
 * @param bucketName Name of the bucket to list objects from
 * @returns List of objects with their details
 */
export const listObjects = async (
  network: "testnet" | "mainnet",
  bucketName: string
): Promise<
  ApiResponse<{ objects: Array<{ objectName: string; createAt: number }> }>
> => {
  try {
    const client = getClient(network)

    // Check if bucket exists first
    try {
      await client.bucket.headBucket(bucketName)
    } catch (error) {
      Logger.error(`Bucket ${bucketName} does not exist`)
      return response.fail(`Bucket ${bucketName} does not exist`)
    }

    const sp = await selectSp(network)
    const objectsRes = await client.object.listObjects({
      bucketName,
      endpoint: sp.endpoint
    })
    if (objectsRes.code !== 0) {
      return response.fail(
        `Failed to list objects: ${JSON.stringify(objectsRes)}`
      )
    }

    const res =
      objectsRes.body?.GfSpListObjectsByBucketNameResponse?.Objects || []
    const objects = res.map((it) => ({
      objectName: it.ObjectInfo.ObjectName,
      createAt: it.ObjectInfo.CreateAt
    }))

    return response.success({ objects })
  } catch (error) {
    Logger.error(`List objects operation failed: ${error}`)
    return response.fail(`List objects operation failed: ${error}`)
  }
}

export const downloadObject = async (
  network: "testnet" | "mainnet",
  {
    privateKey,
    bucketName,
    objectName,
    targetPath
  }: {
    privateKey: Hex
    bucketName: string
    objectName: string
    targetPath?: string
  }
): Promise<ApiResponse<{ file: string }>> => {
  try {
    let filePath = ""
    if (!targetPath || !existsSync(targetPath)) {
      Logger.debug(
        `Target path ${targetPath} does not exist, using current directory`
      )
      // add tmp prefix to avoid file name conflict
      filePath = path.join(process.cwd(), "tmp-" + objectName)
    } else {
      filePath = path.join(targetPath, objectName)
    }

    const client = getClient(network)
    const res = await client.object.getObject(
      {
        bucketName,
        objectName
      },
      {
        type: "ECDSA",
        privateKey: privateKey
      }
    )
    if (res.code !== 0) {
      return response.fail(`Failed to download object: ${JSON.stringify(res)}`)
    }
    // blob to file
    const file = res.body as unknown as Blob
    if (!file) {
      return response.fail("Object is not a file")
    }
    const buffer = await file.arrayBuffer()
    writeFileSync(filePath, Buffer.from(buffer))

    return response.success({ file: filePath })
  } catch (error) {
    Logger.error(`Download object operation failed: ${error}`)
    return response.fail(`Download object operation failed: ${error}`)
  }
}
