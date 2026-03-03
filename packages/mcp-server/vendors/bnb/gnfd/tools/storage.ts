/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import path from "path"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Hex } from "viem"
import { z } from "zod"

import * as services from "@/gnfd/services"
import { mcpToolRes } from "@/utils/helper"
import { bucketNameParam, networkParam, privateKeyParam } from "./common"

export function registerStorageTools(server: McpServer) {
  // Create bucket
  server.tool(
    "gnfd_create_bucket",
    "Create a new bucket in Greenfield storage",
    {
      network: networkParam,
      privateKey: privateKeyParam,
      bucketName: bucketNameParam
    },
    async ({ network, privateKey, bucketName }) => {
      try {
        const result = await services.createBucket(network, {
          privateKey: privateKey as Hex,
          bucketName
        })
        return mcpToolRes.success(result)
      } catch (error) {
        return mcpToolRes.error(error, "creating bucket")
      }
    }
  )

  // Create file
  server.tool(
    "gnfd_create_file",
    "Upload a file to a Greenfield bucket",
    {
      network: networkParam,
      privateKey: privateKeyParam,
      filePath: z
        .string()
        .describe(
          "Absolute path to the file to upload. The file must exist on the machine."
        ),
      bucketName: bucketNameParam
    },
    async ({
      network,
      privateKey,
      filePath,
      bucketName = "created-by-universal-crypto-mcp"
    }) => {
      try {
        // Ensure absolute path is used
        const absoluteFilePath = path.isAbsolute(filePath)
          ? filePath
          : path.resolve(process.cwd(), filePath)

        const result = await services.createFile(network, {
          privateKey: privateKey as Hex,
          filePath: absoluteFilePath,
          bucketName
        })
        return mcpToolRes.success(result)
      } catch (error) {
        return mcpToolRes.error(error, "creating file")
      }
    }
  )

  // Create folder
  server.tool(
    "gnfd_create_folder",
    "Create a folder in a Greenfield bucket",
    {
      network: networkParam,
      privateKey: privateKeyParam,
      folderName: z
        .string()
        .optional()
        .default("created-by-universal-crypto-mcp")
        .describe("Optional folder name. Default is 'created-by-universal-crypto-mcp'"),
      bucketName: bucketNameParam
    },
    async ({ network, privateKey, folderName, bucketName }) => {
      try {
        const result = await services.createFolder(network, {
          privateKey: privateKey as Hex,
          folderName,
          bucketName
        })
        return mcpToolRes.success(result)
      } catch (error) {
        return mcpToolRes.error(error, "creating folder")
      }
    }
  )

  // List buckets
  server.tool(
    "gnfd_list_buckets",
    "List all buckets owned by the account",
    {
      network: networkParam,
      address: z
        .string()
        .optional()
        .describe("The address of the account to list buckets for"),
      privateKey: privateKeyParam
    },
    async ({ network, address, privateKey }) => {
      try {
        const result = await services.listBuckets(network, {
          privateKey: privateKey as Hex,
          address: address as string
        })
        return mcpToolRes.success(result)
      } catch (error) {
        return mcpToolRes.error(error, "listing buckets")
      }
    }
  )

  // List objects
  server.tool(
    "gnfd_list_objects",
    "List all objects in a bucket",
    {
      network: networkParam,
      bucketName: bucketNameParam
    },
    async ({ network, bucketName }) => {
      try {
        const result = await services.listObjects(network, bucketName)
        return mcpToolRes.success(result)
      } catch (error) {
        return mcpToolRes.error(error, "listing objects")
      }
    }
  )

  // Delete object
  server.tool(
    "gnfd_delete_object",
    "Delete an object from a bucket",
    {
      network: networkParam,
      privateKey: privateKeyParam,
      bucketName: bucketNameParam,
      objectName: z.string().describe("The name of the object to delete")
    },
    async ({ network, privateKey, bucketName, objectName }) => {
      try {
        const result = await services.deleteObject(network, {
          privateKey: privateKey as Hex,
          bucketName,
          objectName
        })
        return mcpToolRes.success(result)
      } catch (error) {
        return mcpToolRes.error(error, "deleting object")
      }
    }
  )

  // Delete bucket
  server.tool(
    "gnfd_delete_bucket",
    "Delete a bucket",
    {
      network: networkParam,
      privateKey: privateKeyParam,
      bucketName: bucketNameParam
    },
    async ({ network, privateKey, bucketName }) => {
      try {
        const result = await services.deleteBucket(network, {
          privateKey: privateKey as Hex,
          bucketName
        })
        return mcpToolRes.success(result)
      } catch (error) {
        return mcpToolRes.error(error, "deleting bucket")
      }
    }
  )

  // Get bucket info
  server.tool(
    "gnfd_get_bucket_info",
    "Get detailed information about a bucket",
    {
      network: networkParam,
      bucketName: bucketNameParam
    },
    async ({ network, bucketName }) => {
      try {
        const result = await services.getBucketInfo(network, bucketName)
        return mcpToolRes.success(result)
      } catch (error) {
        return mcpToolRes.error(error, "getting bucket info")
      }
    }
  )

  // Get bucket full info
  server.tool(
    "gnfd_get_bucket_full_info",
    "Get bucket basic information and quota usage",
    {
      network: networkParam,
      bucketName: bucketNameParam,
      privateKey: privateKeyParam
    },
    async ({ network, bucketName, privateKey }) => {
      try {
        const result = await services.getBucketFullInfo(
          network,
          bucketName,
          privateKey as Hex
        )
        return mcpToolRes.success(result)
      } catch (error) {
        return mcpToolRes.error(error, "getting bucket full info")
      }
    }
  )

  // Get object info
  server.tool(
    "gnfd_get_object_info",
    "Get detailed information about an object in a bucket",
    {
      network: networkParam,
      bucketName: bucketNameParam,
      objectName: z.string().describe("The name of the object to get info for")
    },
    async ({ network, bucketName, objectName }) => {
      try {
        const result = await services.getObjectInfo(network, {
          bucketName,
          objectName
        })
        return mcpToolRes.success(result)
      } catch (error) {
        return mcpToolRes.error(error, "getting object info")
      }
    }
  )

  // Download object
  server.tool(
    "gnfd_download_object",
    "Download an object from a bucket",
    {
      network: networkParam,
      bucketName: bucketNameParam,
      objectName: z.string().describe("The name of the object to download"),
      targetPath: z
        .string()
        .optional()
        .describe("The path to save the downloaded object"),
      privateKey: privateKeyParam
    },
    async ({ network, bucketName, objectName, targetPath, privateKey }) => {
      try {
        const result = await services.downloadObject(network, {
          bucketName,
          objectName,
          targetPath,
          privateKey: privateKey as Hex
        })
        return mcpToolRes.success(result)
      } catch (error) {
        return mcpToolRes.error(error, "downloading object")
      }
    }
  )
}
