# MetaMask SDK documentation

> Complete documentation for MetaMask SDK

This file contains all documentation content in a single document following the llmstxt.org standard.

## Connect to MetaMask using JavaScript + ConnectKit


Get started with MetaMask SDK in a JavaScript and ConnectKit dapp.
You can [download the quickstart template](#set-up-using-a-template) or [manually set up the SDK](#set-up-manually) in an existing dapp.

  
    
  

## Prerequisites

- [Node.js](https://nodejs.org/) version 19 or later installed.
- A package manager installed, such as [npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm), [Yarn](https://yarnpkg.com/), [pnpm](https://pnpm.io/installation), or [bun](https://bun.sh/).
- [MetaMask](https://metamask.io/) installed in your browser or on mobile.
- A WalletConnect project ID from the [Reown dashboard](https://dashboard.reown.com/sign-in).

## Set up using a template

1. Download the [MetaMask SDK ConnectKit template](https://github.com/MetaMask/metamask-sdk-examples/tree/main/quickstarts/connectkit):

   ```bash
   npx degit MetaMask/metamask-sdk-examples/quickstarts/connectkit metamask-connectkit
   ```

2. Navigate into the repository:

   ```bash
   cd metamask-connectkit
   ```

    <details>
    <summary>Degit vs. Git clone</summary>
    

   `degit` is a tool that enables cloning only the directory structure from a GitHub repository, without retrieving the entire repository.

   Alternatively, you can use `git clone`, which will download the entire repository.
   To do so, clone the MetaMask SDK examples repository and navigate into the `quickstarts/connectkit` directory:

   ```bash
   git clone https://github.com/MetaMask/metamask-sdk-examples
   cd metamask-sdk-examples/quickstarts/connectkit
   ```

    
    </details>

3. Install dependencies:

   ```bash
   pnpm install
   ```

4. Create a `.env.local` file:

   ```bash
   touch .env.local
   ```

5. In `.env.local`, add a `VITE_WALLETCONNECT_PROJECT_ID` environment variable, replacing `<YOUR-PROJECT-ID>` with your WalletConnect project ID:

   ```text title=".env.local"
   VITE_WALLETCONNECT_PROJECT_ID=<YOUR-PROJECT-ID>
   ```

6. Run the project:

   ```bash
   pnpm dev
   ```

## Set up manually

### 1. Install the SDK

Install MetaMask SDK along with its peer dependencies to an existing React project:

```bash npm2yarn
npm install connectkit wagmi viem@2.x @tanstack/react-query
```

### 2. Import required dependencies

In the root of your project, import the required ConnectKit, Wagmi, and TanStack Query dependencies:

```jsx

```

### 3. Configure your project

Set up your configuration with the desired chains and wallets.
In the following example, add your WalletConnect project ID:

```jsx
const config = createConfig(
  getDefaultConfig({
    // Your dApps chains
    chains: [mainnet, linea, sepolia, lineaSepolia],
    transports: {
      // RPC URL for each chain
      [mainnet.id]: http(),
    },

    // Required API Keys
    walletConnectProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,

    // Required App Info
    appName: 'MetaMask SDK ConnectKit Quickstart',
  })
)
```

### 4. Set up providers

Wrap your application with the `WagmiProvider`, `QueryClientProvider`, and `ConnectKitProvider` providers:

```jsx
const queryClient = new QueryClient()

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider theme="rounded">
          <App />
        </ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>
);
```

### 5. Add the connect button

Import and render the `ConnectKitButton` component:

```jsx

function App() {
  return <ConnectKitButton />
}

export default App
```

You can now test your dapp by running `pnpm run dev`.

## Live example

<iframe className="mt-6" width="100%" height="600px" frameBorder="0" src="https://stackblitz.com/github/MetaMask/metamask-sdk-examples/tree/main/quickstarts/connectkit?ctl=1&embed=1&file=src%2Fmain.tsx&hideNavigation=1"></iframe>

---

## Connect to MetaMask using Dynamic SDK


Get started with MetaMask SDK and [Dynamic SDK](https://docs.dynamic.xyz/introduction/welcome).
You can use MetaMask SDK features directly within Dynamic SDK.
You can [download the quickstart template](#set-up-using-a-template) or [manually set up the SDKs](#set-up-manually) in an existing dapp.

  
    
  

## Prerequisites

- [Node.js](https://nodejs.org/) version 19 or later installed.
- A package manager installed, such as [npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm), [Yarn](https://yarnpkg.com/), [pnpm](https://pnpm.io/installation), or [bun](https://bun.sh/).
- [MetaMask](https://metamask.io/) installed in your browser or on mobile.
- A [Dynamic Environment ID](https://app.dynamic.xyz/).

## Set up using a template

1. Download the [MetaMask SDK + Dynamic SDK template](https://github.com/MetaMask/metamask-sdk-examples/tree/main/partners/dynamic):

   ```bash
   npx degit MetaMask/metamask-sdk-examples/partners/dynamic metamask-dynamic
   ```

2. Navigate into the repository:

   ```bash
   cd metamask-dynamic
   ```

    <details>
    <summary>Degit vs. Git clone</summary>
    

   `degit` is a tool that enables cloning only the directory structure from a GitHub repository, without retrieving the entire repository.

   Alternatively, you can use `git clone`, which will download the entire repository.
   To do so, clone the MetaMask SDK examples repository and navigate into the `partners/dynamic` directory:

   ```bash
   git clone https://github.com/MetaMask/metamask-sdk-examples
   cd metamask-sdk-examples/partners/dynamic
   ```

    
    </details>

3. Install dependencies:

   ```bash
   pnpm install
   ```

4. Create a `.env.local` file:

   ```bash
   touch .env.local
   ```

5. In `.env.local`, add a `NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID` environment variable, replacing `<YOUR-ENVIRONMENT-ID>` with your Dynamic Environment ID:

   ```text title=".env.local"
   NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID=<YOUR-ENVIRONMENT-ID>
   ```

6. Run the project:

   ```bash
   pnpm dev
   ```

You've successfully set up MetaMask SDK and Dynamic SDK.
See how to [use the combined SDKs](#usage).

## Set up manually

### 1. Install dependencies

Install the SDK and the required dependencies to an existing project:

```bash npm2yarn
npm install @dynamic-labs/sdk-react-core @dynamic-labs/ethereum @dynamic-labs/wagmi-connector wagmi viem @tanstack/react-query
```

### 2. Configure providers

Set up your providers in `app/providers.tsx`:

```typescript title="providers.tsx"
"use client";

export function Providers({ children }: { children: React.ReactNode }) {

  const queryClient = new QueryClient();

  return (
    <DynamicContextProvider
      settings={{
        mobileExperience: "redirect",
        environmentId: process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID!,
        walletConnectors: [EthereumWalletConnectors],
        appName: "MetaMask Dynamic Integration",
      }}
    >
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <DynamicWagmiConnector>{children}</DynamicWagmiConnector>
        </QueryClientProvider>
      </WagmiProvider>
    </DynamicContextProvider>
  );
}
```

### 3. Set up environment variables

Create a `.env.local` file.
In `.env.local`, add a `NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID` environment variable, replacing `<YOUR-ENVIRONMENT-ID>` with your Dynamic Environment ID:

```text title=".env.local"
NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID=<YOUR-ENVIRONMENT-ID>
```

You can now test your dapp by running `pnpm run dev`.

## Usage

### Connect wallet

Use the Dynamic Widget in your components:

```typescript
"use client";

export const Navbar = () => {
  return (
    <nav>
      <DynamicWidget />
    </nav>
  );
};
```

### Check wallet status

Use the `useAccount` hook from Wagmi:

```typescript
"use client";

export const Hero = () => {
  const { address, isConnected } = useAccount();

  return (
    
      {isConnected ? (
        Connected: {address}
      ) : (
        Not connected
      )}
    
  );
};
```

## Production readiness

Before deploying your project to production:

1. Update your `next.config.ts` with production domains.
2. Set up proper environment variables.
3. Configure your Dynamic SDK environment ID.
4. Ensure MetaMask SDK is properly initialized.

## Troubleshoot

Common issues and solutions include:

- **SDK initialization error:**
  - Ensure MetaMask is installed.
  - Check environment variables.
  - Verify network connectivity.
- **TypeScript errors:**
  - Update type definitions.
  - Check SDK versions compatibility.
- **Mobile experience issues:**
  - Test on actual mobile devices.
  - Verify redirect URLs.
  - Check MetaMask mobile app installation.

## Live example

<iframe className="mt-6" width="100%" height="600px" frameBorder="0" src="https://stackblitz.com/github/MetaMask/metamask-sdk-examples/tree/main/partners/dynamic?ctl=1&embed=1&file=app%2Fproviders.tsx&hideNavigation=1"></iframe>

---

## Connect to MetaMask using JavaScript + RainbowKit


Get started with MetaMask SDK in a JavaScript and RainbowKit dapp.
You can [download the quickstart template](#set-up-using-a-template) or [manually set up the SDK](#set-up-manually) in an existing dapp.

  
    
  

## Prerequisites

- [Node.js](https://nodejs.org/) version 19 or later installed.
- A package manager installed, such as [npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm), [Yarn](https://yarnpkg.com/), [pnpm](https://pnpm.io/installation), or [bun](https://bun.sh/).
- [MetaMask](https://metamask.io/) installed in your browser or on mobile.
- A WalletConnect project ID from the [Reown dashboard](https://dashboard.reown.com/sign-in).

## Set up using a template

1. Download the [MetaMask SDK RainbowKit template](https://github.com/MetaMask/metamask-sdk-examples/tree/main/quickstarts/rainbowkit):

   ```bash
   npx degit MetaMask/metamask-sdk-examples/quickstarts/rainbowkit metamask-rainbowkit
   ```

2. Navigate into the repository:

   ```bash
   cd metamask-rainbowkit
   ```

    <details>
    <summary>Degit vs. Git clone</summary>
    

   `degit` is a tool that enables cloning only the directory structure from a GitHub repository, without retrieving the entire repository.

   Alternatively, you can use `git clone`, which will download the entire repository.
   To do so, clone the MetaMask SDK examples repository and navigate into the `quickstarts/rainbowkit` directory:

   ```bash
   git clone https://github.com/MetaMask/metamask-sdk-examples
   cd metamask-sdk-examples/quickstarts/rainbowkit
   ```

    
    </details>

3. Install dependencies:

   ```bash
   pnpm install
   ```

4. Create a `.env.local` file:

   ```bash
   touch .env.local
   ```

5. In `.env.local`, add a `VITE_WALLETCONNECT_PROJECT_ID` environment variable, replacing `<YOUR-PROJECT-ID>` with your WalletConnect project ID:

   ```text title=".env.local"
   VITE_WALLETCONNECT_PROJECT_ID=<YOUR-PROJECT-ID>
   ```

6. Run the project:

   ```bash
   pnpm dev
   ```

## Set up manually

### 1. Install the SDK

Install MetaMask SDK along with its peer dependencies to an existing React project:

```bash npm2yarn
npm install @rainbow-me/rainbowkit wagmi viem@2.x @tanstack/react-query
```

### 2. Import required dependencies

In the root of your project, import the required RainbowKit, Wagmi, and TanStack Query dependencies:

```jsx

```

### 3. Configure your project

Set up your configuration with the desired chains and wallets.
In the following example, replace `<YOUR-PROJECT-ID>` with your WalletConnect project ID:

```jsx
const config = getDefaultConfig({
  appName: 'MetaMask SDK RainbowKit Quickstart',
  projectId: '<YOUR-PROJECT-ID>',
  chains: [mainnet, linea, sepolia, lineaSepolia],
  wallets: [
    {
      groupName: 'Preferred',
      wallets: [metaMaskWallet],
    },
  ],
  ssr: false, // true if your dapp uses server-side rendering.
})
```

### 4. Set up providers

Wrap your application with the `WagmiProvider`, `QueryClientProvider`, and `RainbowKitProvider` providers:

```jsx
const queryClient = new QueryClient()

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <App />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>
);
```

### 5. Add the connect button

Import and render the `ConnectButton` component:

```jsx

function App() {
  return <ConnectButton />
}

export default App
```

You can now test your dapp by running `pnpm run dev`.

## Live example

<iframe className="mt-6" width="100%" height="600px" frameBorder="0" src="https://stackblitz.com/github/MetaMask/metamask-sdk-examples/tree/main/quickstarts/rainbowkit?ctl=1&embed=1&file=src%2Fmain.tsx&hideNavigation=1"></iframe>

---

## Connect to MetaMask using JavaScript + Wagmi


Get started with MetaMask SDK in a JavaScript and Wagmi dapp.
You can [download the quickstart template](#set-up-using-a-template) or [manually set up the SDK](#set-up-manually) in an existing dapp.

  <!-- a href="https://metamask-wagmi-demo.vercel.app/" target="_blank" -->
    
  <!-- /a -->

## Prerequisites

- [Node.js](https://nodejs.org/) version 19 or later installed.
- A package manager installed, such as [npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm), [Yarn](https://yarnpkg.com/), [pnpm](https://pnpm.io/installation), or [bun](https://bun.sh/).
- [MetaMask](https://metamask.io/) installed in your browser or on mobile.

## Set up using a template

1. Download the [MetaMask SDK Wagmi template](https://github.com/MetaMask/metamask-sdk-examples/tree/main/quickstarts/wagmi):

   ```bash
   npx degit MetaMask/metamask-sdk-examples/quickstarts/wagmi metamask-wagmi
   ```

2. Navigate into the repository:

   ```bash
   cd metamask-wagmi
   ```

    <details>
    <summary>Degit vs. Git clone</summary>
    

   `degit` is a tool that enables cloning only the directory structure from a GitHub repository, without retrieving the entire repository.

   Alternatively, you can use `git clone`, which will download the entire repository.
   To do so, clone the MetaMask SDK examples repository and navigate into the `quickstarts/wagmi` directory:

   ```bash
   git clone https://github.com/MetaMask/metamask-sdk-examples
   cd metamask-sdk-examples/quickstarts/wagmi
   ```

    
    </details>

3. Install dependencies:

   ```bash
   pnpm install
   ```

4. Run the project:

   ```bash
   pnpm dev
   ```

## Set up manually

### 1. Install the SDK

Install MetaMask SDK along with its peer dependencies to an existing React project:

```bash npm2yarn
npm install @metamask/sdk wagmi viem@2.x @tanstack/react-query
```

### 2. Import required dependencies

In the root of your project, import the required dependencies:

```jsx

```

### 3. Configure your project

Set up your configuration with the desired chains and connectors.
In the following example, set the [`infuraAPIKey`](../reference/sdk-options.md#infuraapikey) option to your [Infura API key](/developer-tools/dashboard/get-started/create-api) to use for RPC requests:

```jsx
const config = createConfig({
  ssr: true, // Enable this if your dapp uses server-side rendering.
  chains: [mainnet, linea, lineaSepolia],
  connectors: [
    metaMask({
      infuraAPIKey: process.env.NEXT_PUBLIC_INFURA_API_KEY!,
    }),
  ],
  transports: {
    [mainnet.id]: http(),
    [linea.id]: http(),
    [lineaSepolia.id]: http(),
  },
});
```

### 4. Set up providers

Wrap your application with the necessary providers:

```jsx
const client = new QueryClient()

const App = () => {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={client}>
        <Component {...pageProps} />
      </QueryClientProvider>
    </WagmiProvider>
  )
}
```

### 5. Add the connect button

Add the wallet connect and disconnect buttons to your application:

```jsx

export const ConnectButton = () => {
  const { address } = useAccount()
  const { connectors, connect } = useConnect()
  const { disconnect } = useDisconnect()

  return (
    
      {address ? (
        <button onClick={() => disconnect()}>Disconnect</button>
      ) : (
        connectors.map(connector => (
          <button key={connector.uid} onClick={() => connect({ connector })}>
            {connector.name}
          </button>
        ))
      )}
    
  )
}
```

Once you've added the connect button, you can test your dapp by running `pnpm run dev`.

## Production readiness

:::tip
For production deployments, it's important to use reliable RPC providers instead of public nodes.
We recommend using services like [MetaMask Developer](https://developer.metamask.io/) to ensure better reliability and performance.
:::

You can configure your RPC endpoints in the Wagmi configuration as follows, replacing `<YOUR-API-KEY>` with your [Infura API key](/developer-tools/dashboard/get-started/create-api):

```jsx
const config = createConfig({
  // ... other config options
  transports: {
    [mainnet.id]: http('https://mainnet.infura.io/v3/<YOUR-API-KEY>'),
    [sepolia.id]: http('https://sepolia.infura.io/v3/<YOUR-API-KEY>'),
  },
})
```

## Next steps

After completing the basic setup, you can follow these guides to add your own functionality:

- [Authenticate users](../guides/authenticate-users.md)
- [Manage networks](../guides/manage-networks.md)
- [Handle transactions](../guides/handle-transactions.md)
- [Interact with smart contracts](../guides/interact-with-contracts.md)

## Live example

<iframe className="mt-6" width="100%" height="600px" frameBorder="0" src="https://stackblitz.com/github/MetaMask/metamask-sdk-examples/tree/main/quickstarts/wagmi?ctl=1&embed=1&file=wagmi.config.ts&hideNavigation=1"></iframe>

---

## Connect to MetaMask using Embedded Wallets SDK


Get started with MetaMask SDK and [Embedded Wallets SDK (previously Web3Auth)](/embedded-wallets),
enabling users to sign in with an email or social media account.
You can use MetaMask SDK features directly within Embedded Wallets SDK.
You can [download the quickstart template](#set-up-using-a-template) or [manually set up the SDKs](#set-up-manually) in an existing dapp.

  
    
  

## Prerequisites

- [Node.js](https://nodejs.org/) version 19 or later installed.
- A package manager installed, such as [npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm), [Yarn](https://yarnpkg.com/), [pnpm](https://pnpm.io/installation), or [bun](https://bun.sh/).
- [MetaMask](https://metamask.io/) installed in your browser or on mobile.
- A [Web3Auth Client ID](/embedded-wallets/dashboard/#get-the-client-id).

## Set up using a template

1. Download the [MetaMask SDK + Web3Auth SDK template](https://github.com/MetaMask/metamask-sdk-examples/tree/main/partners/web3auth):

   ```bash
   npx degit MetaMask/metamask-sdk-examples/partners/web3auth metamask-web3auth
   ```

2. Navigate into the repository:

   ```bash
   cd metamask-web3auth
   ```

    <details>
    <summary>Degit vs. Git clone</summary>
    

   `degit` is a tool that enables cloning only the directory structure from a GitHub repository, without retrieving the entire repository.

   Alternatively, you can use `git clone`, which will download the entire repository.
   To do so, clone the MetaMask SDK examples repository and navigate into the `partners/web3auth` directory:

   ```bash
   git clone https://github.com/MetaMask/metamask-sdk-examples
   cd metamask-sdk-examples/partners/web3auth
   ```

    
    </details>

3. Install dependencies:

   ```bash
   pnpm install
   ```

4. Create a `.env.local` file:

   ```bash
   touch .env.local
   ```

5. In `.env.local`, add a `NEXT_PUBLIC_WEB3AUTH_CLIENT_ID` environment variable, replacing `<YOUR-CLIENT-ID>` with your Web3Auth Client ID:

   ```text title=".env.local"
   NEXT_PUBLIC_WEB3AUTH_CLIENT_ID=<YOUR-CLIENT-ID>
   ```

6. Run the project:

   ```bash
   pnpm dev
   ```

You've successfully set up MetaMask SDK and MetaMask Embedded Wallets.
See how to [use Embedded Wallets](#usage).

## Set up manually

### 1. Install dependencies

Install the SDK and the required dependencies to an existing project:

```bash npm2yarn
npm install viem wagmi @tanstack/react-query @web3auth/modal@10
```

### 2. Configure providers

Set up your providers in `app/providers.tsx`:

```typescript title="providers.tsx"
"use client";

type Props = {
  children: ReactNode;
};

export function Providers({ children }: Props) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <Web3AuthProvider
      config={{
        web3AuthOptions: {
          clientId: process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID!,
          web3AuthNetwork: "sapphire_devnet"
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider>
          {children}
        </WagmiProvider>
      </QueryClientProvider>
    </Web3AuthProvider>
  );
}
```

### 3. Set up environment variables

Create a `.env.local` file.
In `.env.local`, add a `NEXT_PUBLIC_WEB3AUTH_CLIENT_ID` environment variable, replacing `<YOUR-CLIENT-ID>` with your Web3Auth Client ID:

```text title=".env.local"
NEXT_PUBLIC_WEB3AUTH_CLIENT_ID=<YOUR-CLIENT-ID>
```

You can now test your dapp by running `pnpm run dev`.

## Usage

### Connect or sign in

Use the `useWeb3AuthConnect` hook to enable users to connect or sign in to their wallet:

```typescript
"use client";

export const Navbar = () => {
  const { connect } = useWeb3AuthConnect();

  return (
    <nav>
      <button onClick={() => connect()}>Connect or Sign in</button>;
    </nav>
  );
};
```

### Check wallet status

Use the `useAccount` hook from Wagmi to check the wallet status:

```typescript
"use client";

export const Hero = () => {
  const { address, isConnected } = useAccount();

  return (
    
      {isConnected ? Connected: {address} : Not connected}
    
  );
};
```

### Send a transaction

Use the `useSendTransaction` hook from Wagmi to send a transaction:

```typescript
"use client";

export const SendTransaction = () => {
  const { sendTransaction } = useSendTransaction();

  return (
    <button
      onClick={() =>
        sendTransaction({
          to: "0xd2135CfB216b74109775236E36d4b433F1DF507B",
          value: parseEther("0.001"),
        })
      }
    >
      Send transaction
    </button>
  );
};
```

## Live example

<iframe className="mt-6" width="100%" height="600px" frameBorder="0" src="https://stackblitz.com/github/MetaMask/metamask-sdk-examples/tree/main/partners/web3auth?ctl=1&embed=1&file=app%2Fproviders.tsx&hideNavigation=1"></iframe>

---

## Connect to MetaMask using JavaScript


Get started with MetaMask SDK in your JavaScript dapp.
You can [download the quickstart template](#set-up-using-a-template) or [manually set up the SDK](#set-up-manually) in an existing dapp.

  
    
  

## Prerequisites

- [Node.js](https://nodejs.org/) version 19 or later installed.
- A package manager installed, such as [npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm), [Yarn](https://yarnpkg.com/), [pnpm](https://pnpm.io/installation), or [bun](https://bun.sh/).
- [MetaMask](https://metamask.io/) installed in your browser or on mobile.
- An [Infura API key](/developer-tools/dashboard/get-started/create-api) from the MetaMask Developer dashboard.

## Set up using a template

1. Download the [MetaMask SDK JavaScript template](https://github.com/MetaMask/metamask-sdk-examples/tree/main/quickstarts/javascript):

   ```bash
   npx degit MetaMask/metamask-sdk-examples/quickstarts/javascript metamask-javascript
   ```

2. Navigate into the repository:

   ```bash
   cd metamask-javascript
   ```

    <details>
    <summary>Degit vs. Git clone</summary>
    

    `degit` is a tool that enables cloning only the directory structure from a GitHub repository, without retrieving the entire repository.
    
    Alternatively, you can use `git clone`, which will download the entire repository.
    To do so, clone the MetaMask SDK examples repository and navigate into the `quickstarts/javascript` directory:

    ```bash
    git clone https://github.com/MetaMask/metamask-sdk-examples
    cd metamask-sdk-examples/quickstarts/javascript
    ```

    
    </details>

3. Install dependencies:

   ```bash
   pnpm install
   ```

4. Create a `.env.local` file:

   ```bash
   touch .env.local
   ```

5. In `.env.local`, add a `VITE_INFURA_API_KEY` environment variable, replacing `<YOUR-API-KEY>` with your Infura API key:

   ```text title=".env.local"
   VITE_INFURA_API_KEY=<YOUR-API-KEY>
   ```

6. Run the project:

   ```bash
   pnpm dev
   ```

You've successfully set up MetaMask SDK.

## Set up manually

### 1. Install the SDK

Install the SDK in an existing JavaScript project:

```bash npm2yarn
npm install @metamask/sdk
```

### 2. Initialize the SDK

The following are examples of using the SDK in various JavaScript environments:

<Tabs>
<TabItem value="Web dapps">

```javascript

const MMSDK = new MetaMaskSDK({
  dappMetadata: {
    name: "Example JavaScript dapp",
    url: window.location.href,
    // iconUrl: "https://mydapp.com/icon.png" // Optional
  },
  infuraAPIKey: process.env.INFURA_API_KEY,
})
```

</TabItem>
<TabItem value="Pure JavaScript (CDN)">

```html
<head>
  <script src="https://c0f4f41c-2f55-4863-921b-sdk-docs.github.io/cdn/metamask-sdk.js"></script>
  <script>
    const MMSDK = new MetaMaskSDK.MetaMaskSDK({
      dappMetadata: {
        name: "Example JavaScript dapp",
        url: window.location.href,
        // iconUrl: "https://mydapp.com/icon.png" // Optional
      },
      infuraAPIKey: process.env.INFURA_API_KEY,
    })
  </script>
</head>
```

</TabItem>
</Tabs>

These examples configure the SDK with the following options:

- [`dappMetadata`](../reference/sdk-options.md#dappmetadata) - Ensures trust by showing your dapp's `name`, `url`, and `iconUrl` during connection.
- [`infuraAPIKey`](../reference/sdk-options.md#infuraapikey) - Enables read-only RPC and load‑balancing.
  Set this option to your [Infura API key](/developer-tools/dashboard/get-started/create-api).

### 3. Connect and use provider

Connect to MetaMask and get the provider for RPC requests:

```javascript
const provider = MMSDK.getProvider()

const accounts = await MMSDK.connect()
console.log("Connected account:", accounts[0])

const result = await provider.request({
  method: "eth_accounts",
  params: [],
})
console.log("eth_accounts result:", result)
```

`MMSDK.connect()` handles cross-platform connection (desktop and mobile), including deeplinking.

Use `provider.request()` for arbitrary [JSON-RPC requests](/wallet/reference/json-rpc-methods) like `eth_chainId` or `eth_getBalance`, or for [batching requests](../guides/batch-requests.md) via `metamask_batch`.

## Common SDK methods at a glance

| Method                                                                            | Description                                              |
| --------------------------------------------------------------------------------- | -------------------------------------------------------- |
| [`connect()`](../reference/sdk-methods.md#connect)                                | Triggers wallet connection flow                          |
| [`connectAndSign({ msg: "..." })`](../reference/sdk-methods.md#connectandsign)    | Connects and prompts user to sign a message              |
| [`getProvider()`](../reference/sdk-methods.md#getprovider)                        | Returns the provider object for RPC requests             |
| [`provider.request({ method, params })`](/wallet/reference/provider-api/#request) | Calls any Ethereum JSON‑RPC method                       |
| [Batched RPC](../guides/batch-requests.md)                                        | Use `metamask_batch` to group multiple JSON-RPC requests |

## Usage example

```javascript
// 1. Connect and get accounts
const accounts = await MMSDK.connect()

// 2. Connect and sign in one step
const signResult = await MMSDK.connectAndSign({
  msg: "Sign in to the dapp",
})

// 3. Get provider for RPC requests
const provider = MMSDK.getProvider()

// 4. Make an RPC request
const result = await provider.request({
  method: "eth_accounts",
  params: [],
})

// 5. Batch multiple RPC requests
const batchResults = await provider.request({
  method: "metamask_batch",
  params: [{ method: "eth_accounts" }, { method: "eth_chainId" }],
})
```

## Live example

<iframe className="mt-6" width="100%" height="600px" frameBorder="0" src="https://stackblitz.com/github/MetaMask/metamask-sdk-examples/tree/main/quickstarts/javascript?ctl=1&embed=1&file=src%2Fmain.js&hideNavigation=1"></iframe>

---

## Connect to MetaMask using React Native


Get started with MetaMask SDK in your React Native or Expo dapp.

## Steps

### 1. Create a new project

Create a new React Native or Expo project using the following commands:

<Tabs>
  <TabItem value="React Native">

```bash
npx react-native@latest init MyProject
```

  </TabItem>
  <TabItem value="Expo">

```bash
npx create-expo-app devexpo --template
```

  </TabItem>
</Tabs>

### 2. Install dependencies

Install the SDK and its dependencies using the following commands:

<Tabs>
  <TabItem value="React Native">

```bash
npm install eciesjs @metamask/sdk-react ethers@5.7.2 @react-native-async-storage/async-storage node-libs-react-native react-native-background-timer react-native-randombytes react-native-url-polyfill react-native-get-random-values
```

  </TabItem>
  <TabItem value="Expo">

```bash
npx expo install expo-crypto @metamask/sdk-react ethers@5.7.2 @react-native-async-storage/async-storage node-libs-expo react-native-background-timer react-native-randombytes react-native-url-polyfill react-native-get-random-values@1.8.0
```

  </TabItem>
</Tabs>

### 3. Configure Metro

If you're using Expo, run the following command to create a default Metro configuration file:

```bash
npx expo customize metro.config.js
```

In React Native or Expo, update the default Metro configuration file to the following:

<Tabs>
  <TabItem value="React Native">

```javascript title="metro.config.js"
const { getDefaultConfig, mergeConfig } = require("@react-native/metro-config")

const defaultConfig = getDefaultConfig(__dirname)

const config = {
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
  resolver: {
    extraNodeModules: {
      ...require("node-libs-react-native"),
    },
  },
}

module.exports = mergeConfig(defaultConfig, config)
```

  </TabItem>
  <TabItem value="Expo">

```javascript title="metro.config.js"
const config = getDefaultConfig(__dirname)

config.resolver.extraNodeModules = {
  ...require("node-libs-expo"),
}

config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true,
  },
})

module.exports = config
```

  </TabItem>
</Tabs>

### 4. Add required imports

Add the following import statements to the React Native or Expo entry file:

<Tabs>
  <TabItem value="React Native">

```javascript title="index.js or App.tsx"

```

  </TabItem>
  <TabItem value="Expo">

```javascript title="App.tsx"

```

  </TabItem>
</Tabs>

### 5. Build and run

Run the React Native or Expo project on Android or iOS using the following commands:

<Tabs>
  <TabItem value="React Native">

```bash
npx react-native run-android
npx react-native run-ios
```

  </TabItem>
  <TabItem value="Expo">

```bash
# Prebuild first
npx expo prebuild

# Then run
npx expo run:android
npx expo run:ios
```

  </TabItem>
</Tabs>

### 6. Use the SDK

Initialize and use the SDK in your React Native or Expo project using the `useSDK` hook.
For example:

```javascript

function App() {
  const { account, chainId, ethereum, sdk } = useSDK()

  // Connect to MetaMask
  const connectWallet = async () => {
    try {
      await sdk?.connect()
    } catch (error) {
      console.error("Failed to connect wallet:", error)
    }
  }

  // Handle state changes
  useEffect(() => {
    if (account && chainId) {
      // Handle account and network changes
    }
  }, [account, chainId])

  // Disconnect wallet
  const disconnectWallet = async () => {
    await sdk?.terminate()
  }

  return (
    // Your app UI
  )
}
```

## Example

See the [React Native demo](https://github.com/MetaMask/metamask-sdk/tree/main/packages/examples/reactNativeDemo) on GitHub for more information.

---

## Authenticate users


Connect and manage user wallet sessions in your [Wagmi](#use-wagmi) or
[Vanilla JavaScript](#use-vanilla-javascript) dapp.
With the SDK, you can:

- **Connect users' wallets** to your dapp.
- **Access user accounts** (addresses).
- [**Connect and sign**](#connect-and-sign) in a single user interaction.
- **Handle connection states** (connected/disconnected).
- **Listen for account changes** in real time.
- **Manage wallet sessions** (connect/disconnect).
- **Support multiple wallet types** (extension, mobile app).

  
    
  

## Use Wagmi

Wagmi provides a simple, hook-based approach for handling wallet connections.
For example:

```tsx title="Handle wallet connections"

function ConnectWallet() {
  const { address, isConnected } = useAccount()
  const { connectors, connect, isPending } = useConnect()
  const { disconnect } = useDisconnect()

  if (isConnected) {
    return (
      
        Connected to {address}
        <button onClick={() => disconnect()}>Disconnect</button>
      
    )
  }

  return (
    
      {connectors.map((connector) => (
        <button
          key={connector.uid}
          onClick={() => connect({ connector })}
          disabled={isPending}
        >
          {isPending ? "Connecting..." : `Connect ${connector.name}`}
        </button>
      ))}
    
  )
}
```

Wagmi provides a dedicated hook for handling account lifecycle events:

```tsx

function WatchAccount() {
  useAccountEffect({
    onConnect(data) {
      console.log("Connected!", {
        address: data.address,
        chainId: data.chainId,
        isReconnected: data.isReconnected
      })
    },
    onDisconnect() {
      console.log("Disconnected!")
    }
  })
  
  return Watching for account changes...
}
```

## Use Vanilla JavaScript

You can implement user authentication directly in Vanilla JavaScript, using the
[`eth_requestAccounts`](/wallet/reference/json-rpc-methods/eth_requestaccounts) RPC method
and [`accountsChanged`](/wallet/reference/provider-api/#accountschanged) provider event.
For example:

```javascript

// Initialize SDK
const MMSDK = new MetaMaskSDK();
const provider = MMSDK.getProvider();

// Connect wallet
async function connectWallet() {
  try {
    // Disable button while request is pending
    document.getElementById("connectBtn").disabled = true;
    
    const accounts = await provider.request({ 
      method: "eth_requestAccounts" 
    });
    
    const account = accounts[0];
    console.log("Connected:", account);
    
    // Update UI
    document.getElementById("status").textContent = `Connected: ${account}`;
    document.getElementById("connectBtn").style.display = "none";
    document.getElementById("disconnectBtn").style.display = "block";
  } catch (err) {
    if (err.code === 4001) {
      console.log("User rejected connection");
    } else {
      console.error(err);
    }
  } finally {
    document.getElementById("connectBtn").disabled = false;
  }
}

// Disconnect wallet
async function disconnectWallet() {
  try {
    await MMSDK.terminate()
  } catch (err) {
    console.error("Error with disconnecting:", err)
  }
}

// Handle account changes
provider.on("accountsChanged", (accounts) => {
  if (accounts.length === 0) {
    // User disconnected
    document.getElementById("status").textContent = "Not connected";
    document.getElementById("connectBtn").style.display = "block";
    document.getElementById("disconnectBtn").style.display = "none";
  } else {
    // Account changed
    document.getElementById("status").textContent = `Connected: ${accounts[0]}`;
  }
});
```

Display connect and disconnect buttons in HTML:

```html

  Not connected
  <button id="connectBtn" onclick="connectWallet()">Connect MetaMask</button>
  <button id="disconnectBtn" style="display: none" onclick="disconnectWallet()">
    Disconnect
  </button>

```

### Connect and sign

If you're not using Wagmi, you can access MetaMask SDK's [`connectAndSign`](../reference/sdk-methods.md#connectandsign) method,
which requests wallet access and signs the message in a single user interaction.
For example:

```js

const MMSDK = new MetaMaskSDK()
const provider = MMSDK.getProvider()

async function handleConnectAndSign() {
  try {
    const signature = await MMSDK.connectAndSign({ msg: "Hello in one go!" })
    console.log("Signature:", signature)
  } catch (err) {
    console.error("Error with connectAndSign:", err)
  }
}

document
  .getElementById("connectSignBtn")
  .addEventListener("click", handleConnectAndSign)
```

The following HTML displays a **Connect & Sign** button:

```html
<button id="connectSignBtn">Connect & Sign</button>
```

:::tip
This one-step flow is unique to MetaMask SDK's `connectAndSign` method.
It's not part of Wagmi or other wallet libraries.
:::

## Best practices

Follow these best practices when authenticating users.

#### User interaction

- Only trigger connection requests in response to user actions (like selecting a button).
- Never auto-connect on page load.
- Provide clear feedback during connection states.

#### Error handling

- Handle [common errors](#common-errors) like user rejection (code `4001`).
- Provide clear error messages to users.
- Fall back gracefully when MetaMask is not installed.

#### Account changes

- Always listen for account changes.
- Update your UI when accounts change.
- Handle disconnection events.

#### Chain support

- Listen for network/chain changes.
- Verify the current chain meets your requirements.
- Provide clear messaging when users need to switch networks.

Learn how to [manage networks](manage-networks.md).

## Common errors

The following table lists common authentication errors and their codes:

| Error code | Description | Solution |
|------------|-------------|----------|
| `4001`   | User rejected request   | Show a message asking the user to approve the connection. |
| `-32002` | Request already pending | Disable the connect button while the request is pending. |
| `-32603` | Internal JSON-RPC error | Check if MetaMask is properly installed. |

## Next steps

See the following guides to add more functionality to your dapp:

- [Manage networks](manage-networks.md)
- [Handle transactions](handle-transactions.md)
- [Interact with smart contracts](interact-with-contracts.md)

---

## Batch requests


MetaMask SDK provides mechanisms to send multiple JSON-RPC requests in a single call.
However, "batching" can be used in a few different contexts:

- [**Wagmi batching for contract reads**](#use-wagmi-usereadcontracts) - Wagmi does not support MetaMask's generic batching mechanism.
   Instead, it provides the [`useReadContracts`](https://wagmi.sh/react/api/hooks/useReadContracts) hook to perform multiple contract read operations in a single hook call.
   This is specialized for retrieving data from smart contracts and returns an array of results corresponding to each read call.
   `useReadContracts` does not support batching JSON-RPC methods.

- [**Vanilla JavaScript batching with `metamask_batch`**](#use-vanilla-javascript-metamask_batch) -
   This approach uses MetaMask SDK's `metamask_batch` method to group any JSON-RPC requests together, whether they are contract calls or other JSON-RPC methods (for example, signing messages or sending transactions).
   Despite being batched into one HTTP request, each call still requires individual user approval, and if any request is rejected, the entire batch fails.

:::info
"Batching" can also refer to [sending atomic batch transactions](/wallet/how-to/send-transactions/send-batch-transactions) in MetaMask.
Use the methods introduced by EIP-5792 to send atomic batches.
:::

## Use Wagmi (`useReadContracts`)

When using Wagmi, you can perform multiple contract read operations in a single hook call using `useReadContracts`.
This method is designed specifically for contract calls and batches them together internally, returning the results as an array.
It is not a generic JSON-RPC batching tool but rather a specialized solution for reading from smart contracts.

For more information, see the [Wagmi documentation](https://wagmi.sh/react/api/hooks/useReadContracts).

The following is an example of batching read operations using `useReadContracts`:

```js

// Example contract definitions with their address and ABI
const contractA = {
  address: "0xContractAddress1",
  abi: contractABI1,
} as const;

const contractB = {
  address: "0xContractAddress2",
  abi: contractABI2,
} as const;

function MyBatchReadComponent() {
  const { data, isError, isLoading } = useReadContracts({
    contracts: [
      {
        ...contractA,
        functionName: "getValueA",
      },
      {
        ...contractA,
        functionName: "getValueB",
      },
      {
        ...contractB,
        functionName: "getValueX",
        args: [42],
      },
      {
        ...contractB,
        functionName: "getValueY",
        args: [42],
      },
    ],
  });

  if (isLoading) return Loading...;
  if (isError) return Error fetching data.;

  return (
    
      getValueA: {data?.[0]?.toString()}
      getValueB: {data?.[1]?.toString()}
      getValueX: {data?.[2]?.toString()}
      getValueY: {data?.[3]?.toString()}
    
  );
}
```

In this example, four contract read calls are batched together.
The results are returned as an array in the same order as the calls, allowing you to process each result accordingly.

:::tip
For a better user experience, it's important to use reliable RPC providers instead of public nodes.
We recommend using services like [MetaMask Developer](https://developer.metamask.io/) to ensure better reliability and performance.
:::

## Use Vanilla JavaScript (`metamask_batch`)

If you're not using Wagmi, you can directly use MetaMask SDK's `metamask_batch` method to group multiple JSON-RPC requests into a single HTTP call.

Use cases include:

- **Batching multiple signatures** - Send multiple signing requests in one batch.
- **Switching networks** - Switch the EVM network, perform an action such as sending a transaction, and switch back, all in one batch.
- **Mixed transactions and signatures** - Combine transaction sending and signing requests in one batch.

:::note
When using `metamask_batch`, keep in mind the following:

- Even though the requests are batched, each individual request still requires user approval.
- If any request in the batch is rejected, the entire batch will fail.
:::

The following is an example of batching JSON-RPC requests using `metamask_batch`:

```js

const MMSDK = new MetaMaskSDK();
const provider = MMSDK.getProvider();

async function handleBatchRequests() {
  // Example batch: one personal_sign call and one eth_sendTransaction call.
  const requests = [
    { method: "personal_sign", params: ["Hello from batch!", "0x1234..."] },
    {
      method: "eth_sendTransaction",
      params: [
        {
          from: "0x1234...",
          to: "0xABCD...",
          // Additional transaction parameters.
        },
      ],
    },
  ];

  try {
    const results = await provider.request({
      method: "metamask_batch",
      params: [requests],
    });
    console.log("Batch Results:", results);
  } catch (err) {
    console.error("Batch request failed:", err);
  }
}

document.getElementById("batchBtn").addEventListener("click", handleBatchRequests);
```

The following HTML displays a **Send Batch** button:

```html
<button id="batchBtn">Send Batch</button>
```

:::tip Tips
- For a better user experience, it's important to use reliable RPC providers instead of public nodes.
  We recommend using services like [MetaMask Developer](https://developer.metamask.io/) to ensure better reliability and performance.
- Ensure that requests in a batch do not depend on one another's chain context, as mid-batch state changes can affect outcomes.
:::

---

## Handle transactions


Handle EVM transactions in your [Wagmi](#use-wagmi) or [Vanilla JavaScript](#use-vanilla-javascript) dapp.
With the SDK, you can:

- **Send transactions**.
- **Track transaction status** in real time.
- **Estimate gas costs** accurately.
- **Handle transaction errors** gracefully.
- **Manage complex transaction patterns**.

## Use Wagmi

Wagmi provides hooks for sending transactions and tracking their status.
The following are examples of sending a [basic transaction](#basic-transaction) and an
[advanced transaction with gas estimation](#advanced-transaction-with-gas-estimation).

### Basic transaction

```tsx

function SendTransaction() {
  const { 
    data: hash,
    error,
    isPending,
    sendTransaction
  } = useSendTransaction()

  const { 
    isLoading: isConfirming,
    isSuccess: isConfirmed 
  } = useWaitForTransactionReceipt({
    hash
  })

  async function handleSend() {
    sendTransaction({
      to: "0x...", 
      value: parseEther("0.1")  // 0.1 ETH
    })
  }

  return (
    
      <button 
        onClick={handleSend}
        disabled={isPending}
      >
        {isPending ? "Confirming..." : "Send 0.1 ETH"}
      </button>

      {hash && (
        
          Transaction Hash: {hash}
          {isConfirming && Waiting for confirmation...}
          {isConfirmed && Transaction confirmed!}
        
      )}

      {error && Error: {error.message}}
    
  )
}
```

### Advanced transaction with gas estimation

```tsx

  useSendTransaction, 
  useWaitForTransactionReceipt,
  useEstimateGas
} from "wagmi"

function AdvancedTransaction() {
  const transaction = {
    to: "0x...",
    value: parseEther("0.1"),
    data: "0x..." // Optional contract interaction data
  }

  // Estimate gas
  const { data: gasEstimate } = useEstimateGas(transaction)

  const { sendTransaction } = useSendTransaction({
    ...transaction,
    gas: gasEstimate,
    onSuccess: (hash) => {
      console.log("Transaction sent:", hash)
    }
  })

  return <button onClick={() => sendTransaction()}>Send with Gas Estimate</button>
}
```

## Use Vanilla JavaScript

You can implement transaction handling directly in Vanilla JavaScript.
The following are examples of sending a [basic transaction](#basic-transaction-1) and an
[advanced transaction with gas estimation](#advanced-transaction-with-gas-estimation-1).

### Basic transaction

The basic transaction uses the [`eth_requestAccounts`](/wallet/reference/json-rpc-methods/eth_requestaccounts),
[`eth_sendTransaction`](/wallet/reference/json-rpc-methods/eth_sendtransaction), and
[`eth_getTransactionReceipt`](/wallet/reference/json-rpc-methods/eth_gettransactionreceipt)
RPC methods.

```javascript
async function sendTransaction(recipientAddress, amount) {
  try {
    // Get current account
    const accounts = await ethereum.request({ 
      method: "eth_requestAccounts" 
    });
    const from = accounts[0];

    // Convert ETH amount to wei (hex)
    const value = `0x${(amount * 1e18).toString(16)}`;

    // Prepare transaction
    const transaction = {
      from,
      to: recipientAddress,
      value,
      // Gas fields are optional - MetaMask will estimate
    };

    // Send transaction
    const txHash = await ethereum.request({
      method: "eth_sendTransaction",
      params: [transaction],
    });

    return txHash;
  } catch (error) {
    if (error.code === 4001) {
      throw new Error("Transaction rejected by user");
    }
    throw error;
  }
}

// Track transaction status
function watchTransaction(txHash) {
  return new Promise((resolve, reject) => {
    const checkTransaction = async () => {
      try {
        const tx = await ethereum.request({
          method: "eth_getTransactionReceipt",
          params: [txHash],
        });

        if (tx) {
          if (tx.status === "0x1") {
            resolve(tx);
          } else {
            reject(new Error("Transaction failed"));
          }
        } else {
          setTimeout(checkTransaction, 2000); // Check every 2 seconds
        }
      } catch (error) {
        reject(error);
      }
    };

    checkTransaction();
  });
}
```

The following is an example implementation of the basic transaction:

```html

  <input type="text" id="recipient" placeholder="Recipient Address">
  <input type="number" id="amount" placeholder="Amount in ETH">
  <button onclick="handleSend()">Send ETH</button>
  

<script>
async function handleSend() {
  const recipient = document.getElementById("recipient").value;
  const amount = document.getElementById("amount").value;
  const status = document.getElementById("status");
  
  try {
    status.textContent = "Sending transaction...";
    const txHash = await sendTransaction(recipient, amount);
    status.textContent = `Transaction sent: ${txHash}`;

    // Watch for confirmation
    status.textContent = "Waiting for confirmation...";
    await watchTransaction(txHash);
    status.textContent = "Transaction confirmed!";
  } catch (error) {
    status.textContent = `Error: ${error.message}`;
  }
}
</script>
```

### Advanced transaction with gas estimation

To add gas estimation, use the [`eth_estimateGas`](/wallet/reference/json-rpc-methods/eth_estimategas)
RPC method.

```javascript
async function estimateGas(transaction) {
  try {
    const gasEstimate = await ethereum.request({
      method: "eth_estimateGas",
      params: [transaction]
    });
    
    // Add 20% buffer for safety
    return BigInt(gasEstimate) * 120n / 100n;
  } catch (error) {
    console.error("Gas estimation failed:", error);
    throw error;
  }
}
```

## Best practices

Follow these best practices when handling transactions.

#### Transaction security

- Always **validate inputs** before sending transactions.
- Check wallet balances to **ensure sufficient** funds.
- **Verify addresses** are valid.

#### Error handling

- Handle [common errors](#common-errors) like **user rejection** and **insufficient funds**.
- Provide **clear error messages** to users.
- Implement proper **error recovery** flows.
- Consider **network congestion** in gas estimates.

#### User experience

- Display **clear loading states** during transactions.
- Show **transaction progress** in real time.
- Provide **detailed transaction information**.
## Common errors

| Error code | Description | Solution |
|------------|-------------|----------|
| `4001`   | User rejected transaction | Show a retry option and a clear error message.  |
| `-32603` | Insufficient funds        | Check the balance before sending a transaction. |
| `-32000` | Gas too low               | Increase the gas limit or add a buffer to the estimation. |
| `-32002` | Request already pending   | Prevent multiple concurrent transactions.       |

## Next steps

See the following guides to add more functionality to your dapp:

- [Authenticate users](authenticate-users.md)
- [Manage networks](manage-networks.md)
- [Interact with smart contracts](interact-with-contracts.md)

---

## Interact with smart contracts


Interact with smart contracts in your [Wagmi](#use-wagmi) or [Vanilla JavaScript](#use-vanilla-javascript) dapp.
With the SDK, you can:

- **Read data** from smart contracts.
- **Write data** to smart contracts.
- **Handle contract events**.
- **Manage transaction states**.
- **Handle contract errors**.

## Use Wagmi

Wagmi provides dedicated hooks for smart contract interactions.
The following are examples of using these hooks.

Read contract data:

```tsx

function TokenBalance() {
  const { 
    data: balance,
    isError,
    isLoading 
  } = useReadContract({
    address: "0xFBA3912Ca04dd458c843e2EE08967fC04f3579c2",
    abi: [
      {
        name: "balanceOf",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "owner", type: "address" }],
        outputs: [{ name: "balance", type: "uint256" }],
      },
    ],
    functionName: "balanceOf",
    args: ["0x03A71968491d55603FFe1b11A9e23eF013f75bCF"],
  })

  if (isLoading) return Loading balance...
  if (isError) return Error fetching balance
  
  return Balance: {balance?.toString()}
}
```

Write to contracts:

```tsx

function MintNFT() {
  const { 
    writeContract,
    data: hash,
    error,
    isPending 
  } = useWriteContract()

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed
  } = useWaitForTransactionReceipt({
    hash
  })
  
  function mint() {
    writeContract({
      address: "0xFBA3912Ca04dd458c843e2EE08967fC04f3579c2",
      abi: [
        {
          name: "mint",
          type: "function",
          stateMutability: "nonpayable",
          inputs: [{ name: "tokenId", type: "uint256" }],
          outputs: [],
        },
      ],
      functionName: "mint",
      args: [123n], // Token ID
    })
  }
  
  return (
    
      <button 
        onClick={mint}
        disabled={isPending || isConfirming}
      >
        {isPending ? "Confirming..." : "Mint NFT"}
      </button>

      {hash && (
        
          Transaction Hash: {hash}
          {isConfirming && Waiting for confirmation...}
          {isConfirmed && NFT Minted Successfully!}
        
      )}

      {error && Error: {error.message}}
    
  )
}
```

## Use Vanilla JavaScript

You can implement smart contract interactions directly in Vanilla JavaScript.

The following example reads contract data using the [`eth_call`](/wallet/reference/json-rpc-methods/eth_call) RPC method:

```javascript
async function getBalance(contractAddress, userAddress) {
  try {
    // Create function signature for balanceOf(address)
    const functionSignature = "0x70a08231";
    // Pad address to 32 bytes
    const encodedAddress = userAddress.slice(2).padStart(64, "0");
    
    const result = await ethereum.request({
      method: "eth_call",
      params: [{
        to: contractAddress,
        data: functionSignature + encodedAddress,
      }],
    });
    
    return BigInt(result);
  } catch (error) {
    console.error("Error reading balance:", error);
    throw error;
  }
}

// Example usage
async function displayBalance() {
  const status = document.getElementById("status");
  try {
    const balance = await getBalance(
      "0xContractAddress",
      "0xUserAddress"
    );
    status.textContent = `Balance: ${balance.toString()}`;
  } catch (error) {
    status.textContent = `Error: ${error.message}`;
  }
}
```

The following example writes to contracts using the [`eth_requestAccounts`](/wallet/reference/json-rpc-methods/eth_requestaccounts),
[`eth_sendTransaction`](/wallet/reference/json-rpc-methods/eth_sendtransaction), and
[`eth_getTransactionReceipt`](/wallet/reference/json-rpc-methods/eth_gettransactionreceipt)
RPC methods:

```javascript
async function mintNFT(contractAddress, tokenId) {
  try {
    // Get user's account
    const accounts = await ethereum.request({ 
      method: "eth_requestAccounts" 
    });
    
    // Create function signature for mint(uint256)
    const functionSignature = "0x6a627842";
    // Pad tokenId to 32 bytes
    const encodedTokenId = tokenId.toString(16).padStart(64, "0");
    
    // Send transaction
    const txHash = await ethereum.request({
      method: "eth_sendTransaction",
      params: [{
        from: accounts[0],
        to: contractAddress,
        data: functionSignature + encodedTokenId,
      }],
    });

    return txHash;
  } catch (error) {
    if (error.code === 4001) {
      throw new Error("Transaction rejected by user");
    }
    throw error;
  }
}

// Track transaction status
async function watchTransaction(txHash) {
  return new Promise((resolve, reject) => {
    const checkTransaction = async () => {
      try {
        const tx = await ethereum.request({
          method: "eth_getTransactionReceipt",
          params: [txHash],
        });

        if (tx) {
          if (tx.status === "0x1") {
            resolve(tx);
          } else {
            reject(new Error("Transaction failed"));
          }
        } else {
          setTimeout(checkTransaction, 2000);
        }
      } catch (error) {
        reject(error);
      }
    };

    checkTransaction();
  });
}
```

The following is an example implementation of contract interaction:

```html

  <button onclick="handleMint()">Mint NFT</button>
  

<script>
async function handleMint() {
  const status = document.getElementById("status");
  
  try {
    status.textContent = "Sending transaction...";
    const txHash = await mintNFT("0xContractAddress", 123);
    status.textContent = `Transaction sent: ${txHash}`;

    status.textContent = "Waiting for confirmation...";
    await watchTransaction(txHash);
    status.textContent = "NFT Minted Successfully!";
  } catch (error) {
    status.textContent = `Error: ${error.message}`;
  }
}
</script>
```

## Best practices

Follow these best practices when interacting with smart contracts.

#### Contract validation

- Always **verify contract addresses**.
- Double check **ABI correctness**.
- **Validate input data** before sending.
- Use **typed data** when possible (for example, using [Viem](https://viem.sh/)).

#### Error handling

- Handle [common errors](#common-errors) like **user rejection** and **contract reverts**.
- Provide **clear error messages** to users.
- Implement proper **error recovery** flows.
- Consider **gas estimation failures**.

#### User experience

- Show **clear loading states**.
- Display **transaction progress**.
- Provide **confirmation feedback**.
- Enable proper **error recovery**.

## Common errors

| Error code | Description | Solution |
|------------|-------------|----------|
| `4001`   | User rejected transaction   | Show a retry option and a clear error message. |
| `-32000` | Invalid input               | Validate the input data before sending.        |
| `-32603` | Contract execution reverted | Check the contract conditions and handle the error gracefully. |
| `-32002` | Request already pending     | Prevent multiple concurrent transactions.      |

## Next steps

See the following guides to add more functionality to your dapp:

- [Authenticate users](authenticate-users.md)
- [Manage networks](manage-networks.md)
- [Handle transactions](handle-transactions.md)

---

## Manage networks


Manage networks in your [Wagmi](#use-wagmi) or [Vanilla JavaScript](#use-vanilla-javascript) dapp.
With the SDK, you can:

- **Detect the current network** and monitor network changes.
- **Switch between networks** programmatically.
- **Add new networks** to MetaMask.
- **Handle common network-related errors**.

  
    
  

## Use Wagmi

Wagmi provides intuitive hooks for several network-related operations.
The following are examples of using these hooks.

Detect the current network:

```tsx

function NetworkStatus() {
  const chainId = useChainId()
  const chains = useChains()
  
  const currentChain = chains.find(c => c.id === chainId)
  
  if (!currentChain) {
    return Not connected to any network
  }

  return (
    
      Connected to {currentChain.name}
      Chain ID: {chainId}
      Supported chains: {chains.map(c => c.name).join(", ")}
    
  )
}
```

Switch networks:

```tsx

function NetworkSwitcher() {
  const { chains, switchChain } = useSwitchChain()
  
  return (
    
      {chains.map((chain) => (
        <button
          key={chain.id}
          onClick={() => switchChain({ chainId: chain.id })}
        >
          Switch to {chain.name}
        </button>
      ))}
    
  )
}
```

Handle network changes:

```tsx

function NetworkWatcher() {
  const chainId = useChainId()
  
  useEffect(() => {
    console.log("Chain ID changed:", chainId)
  }, [chainId])
  
  return null
}
```

## Use Vanilla JavaScript

You can implement network management directly in Vanilla JavaScript.

The following example detects the current network using the
[`eth_chainId`](/wallet/reference/json-rpc-methods/eth_chainid) RPC method and
[`chainChanged`](/wallet/reference/provider-api/#chainchanged) provider event:

```javascript
// Get current chain ID
async function getCurrentChain() {
  try {
    const chainId = await ethereum.request({ 
      method: "eth_chainId" 
    });
    console.log("Current chain ID:", chainId);
    return chainId;
  } catch (err) {
    console.error("Error getting chain:", err);
  }
}

// Listen for network changes
ethereum.on("chainChanged", (chainId) => {
  console.log("Network changed to:", chainId);
  // We recommend reloading the page
  window.location.reload();
});
```

The following example switches networks using the
[`wallet_switchEthereumChain`](/wallet/reference/json-rpc-methods/wallet_switchethereumchain)
and [`wallet_addEthereumChain`](/wallet/reference/json-rpc-methods/wallet_addethereumchain)
RPC methods:

```javascript
// Network configurations
const networks = {
  mainnet: {
    chainId: "0x1",
    name: "Ethereum Mainnet"
  },
  optimism: {
    chainId: "0xA",
    name: "Optimism",
    rpcUrls: ["https://mainnet.optimism.io"],
    nativeCurrency: {
      name: "Ethereum",
      symbol: "ETH",
      decimals: 18
    },
    blockExplorerUrls: ["https://optimistic.etherscan.io"]
  }
};

async function switchNetwork(networkKey) {
  const network = networks[networkKey];
  
  try {
    // Try to switch to the network
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: network.chainId }]
    });
  } catch (err) {
    // If the error code is 4902, the network needs to be added
    if (err.code === 4902) {
      try {
        await ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: network.chainId,
            chainName: network.name,
            rpcUrls: network.rpcUrls,
            nativeCurrency: network.nativeCurrency,
            blockExplorerUrls: network.blockExplorerUrls
          }]
        });
      } catch (addError) {
        console.error("Error adding network:", addError);
      }
    } else {
      console.error("Error switching network:", err);
    }
  }
}
```

Display the current network and a switch network button in HTML:

```html

  Current Network: Loading...
  <button onclick="switchNetwork("mainnet")">Switch to Mainnet</button>
  <button onclick="switchNetwork("optimism")">Switch to Optimism</button>

```

## Best practices

Follow these best practices when managing networks.

#### Error handling

- Implement error handling for network switching operations.
- Provide **clear feedback messages** to users when network operations fail.
- Handle cases where networks need to be **added before switching**.

#### User experience

- Display **loading states** during network switches.
- Show **clear network status information** at all times.
- Consider **warning users** before initiating network switches.
- Use an **RPC provider** that supports your target networks.

## Common errors

The following table lists common network management errors and their codes:

| Error code | Description | Solution |
|------------|-------------|----------|
| `4902`   | Network not added       | Use [`wallet_addEthereumChain`](/wallet/reference/json-rpc-methods/wallet_addethereumchain) to add the network first. |
| `4001`   | User rejected request   | Show a message asking the user to approve the network switch. |
| `-32002` | Request already pending | Disable the switch network button while the request is pending. |

## Next steps

See the following guides to add more functionality to your dapp:

- [Authenticate users](authenticate-users.md)
- [Handle transactions](handle-transactions.md)
- [Interact with smart contracts](interact-with-contracts.md)

---

## Production readiness


When using MetaMask SDK, ensure your dapp is production ready by focusing on these key areas unique to MetaMask:

- [Wallet connection and mobile compatibility](#wallet-connection-and-mobile-compatibility)
- [Reliable RPC endpoints](#reliable-rpc-endpoints)
- [Error handling and recovery](#error-handling-and-recovery)

## Wallet connection and mobile compatibility

- **Cross-platform testing** - Verify that your dapp's wallet connection flow works seamlessly on desktop (via the MetaMask browser extension) and mobile devices (via QR codes or deeplinks).

- **Responsive UI** - Ensure that touch interactions and responsive layouts are optimized for mobile users.

## Reliable RPC endpoints

- **Custom RPC setup** - Use production-grade RPC endpoints and custom API keys by signing up on [MetaMask Developer](https://developer.metamask.io/).
  This improves reliability over public nodes.

- **Configuration** - Configure your Wagmi (or MetaMask SDK) setup with your custom RPC URL using environment variables.
For example:

  ```tsx title="Configure custom RPC endpoint"

  export const config = createConfig({
    chains: [mainnet],
    connectors: [metaMask()],
    transports: {
      [mainnet.id]: http(process.env.NEXT_PUBLIC_METAMASK_RPC_URL),
    },
  });
  ```

## Error handling and recovery

- **Clear feedback** - Display user friendly messages when wallet connection or transaction errors occur (for example, network switch failures or user rejections).

- **Event management** - If you're using Vanilla JavaScript, handle MetaMask events such as [`chainChanged`](/wallet/reference/provider-api/#chainchanged)
  and [`accountsChanged`](/wallet/reference/provider-api/#accountschanged) to promptly update the UI and internal state.
  If you're using Wagmi, you generally don't need to handle MetaMask events, because the hooks will handle the events for you.

---

## Use deeplinks


You can use deeplinks to directly route your users to specific, pre-configured functions inside the MetaMask mobile app.
For example, you can create a deeplink that lets users make one-click payments with a preset token, recipient, and amount.
You can also convert deeplinks to QR codes, so users can scan them with a mobile device.

If a user doesn't have the mobile app installed, deeplinks route the user to a landing page where they can download the app.

This page highlights deeplinks available for the MetaMask mobile app.

## Open a dapp inside the in-app browser

<Tabs>
<TabItem value="Deeplink">

```text
https://link.metamask.io/dapp/{dappUrl}
```

</TabItem>
<TabItem value="Example">

```text
https://link.metamask.io/dapp/app.uniswap.org
```

</TabItem>
</Tabs>

This deeplink takes the user directly to the dapp URL in the MetaMask mobile in-app browser.

The example navigates to `app.uniswap.org` in the in-app browser.

### Path parameters

- `dappUrl` - Dapp URL.

## Send native currency

<Tabs>
<TabItem value="Deeplink">

```text
https://link.metamask.io/send/{recipient}@{chainId}
```

</TabItem>
<TabItem value="Example">

```text
https://link.metamask.io/send/0x0000000@137?value=1e16
```

</TabItem>
</Tabs>

This deeplink starts the process of sending a transaction in the native currency.
If the chain ID is specified, the MetaMask mobile app automatically switches to the correct network.

The example displays the confirmation screen to send 0.01 POL (`1e16` wei) in Polygon (chain ID `137`) to the recipient address `0x0000000`.

### Path parameters

- `recipient` - Address of the recipient.
- `chainId` - (Optional) Chain ID of the network to use.

### Query string parameters

- `value` - Amount to be transferred, in the native currency's smallest unit.

## Send an ERC-20 token

<Tabs>
<TabItem value="Deeplink">

```text
https://link.metamask.io/send/{contractAddress}@{chainId}/transfer
```

</TabItem>
<TabItem value="Example">

```text
https://link.metamask.io/send/0x176211869cA2b568f2A7D4EE941E073a821EE1ff@59144/transfer?address=0x0000000&uint256=1e6
```

</TabItem>
</Tabs>

This deeplink starts the process of sending a transaction in an ERC-20 token.
If the chain ID is specified, the MetaMask mobile app automatically switches to the correct network.

The example displays the confirmation screen to send 1 USDC (`1e6` units, contract address `0x176211869cA2b568f2A7D4EE941E073a821EE1ff`) on Linea (chain ID `59144`) to recipient address `0x0000000`.

### Path parameters

- `contractAddress` - Contract address of the ERC-20 token.
- `chainId` - (Optional) Chain ID of the network to use.

### Query string parameters

- `address` - Address of the recipient.
- `uint256` - Amount to be transferred, in the token's smallest unit.

## Start the on-ramp process

<Tabs>
<TabItem value="Deeplink">

```text
https://link.metamask.io/buy
```

</TabItem>
<TabItem value="Example">

```text
https://link.metamask.io/buy?chainId=59144&address=0x176211869cA2b568f2A7D4EE941E073a821EE1ff&amount=100
```

</TabItem>
</Tabs>

This deeplink starts the on-ramp process to buy native currency or ERC-20 tokens.
If the chain ID is specified, the MetaMask mobile app automatically switches to the correct network.

The example starts the on-ramp process to buy $100 (`amount=100`) of USDC (contract address `0x176211869cA2b568f2A7D4EE941E073a821EE1ff`) on Linea (chain ID `59144`).
The fiat currency depends on the onboarding status of the user and the region they select.

:::note
You can use the `/buy` or `/buy-crypto` path for this deeplink.
:::

### Query string parameters

- `chainId` - (Optional) Chain ID of the network to use.
- `address` - (Optional) Contract address of the ERC-20 token.
  If omitted, the native currency is used.
- `amount` - (Optional) Amount to buy, in the user's fiat currency.

## Start the off-ramp process

<Tabs>
<TabItem value="Deeplink">

```text
https://link.metamask.io/sell
```

</TabItem>
<TabItem value="Example">

```text
https://link.metamask.io/sell?chainId=59144&amount=125
```

</TabItem>
</Tabs>

This deeplink starts the off-ramp process to sell native currency.
If the chain ID is specified, the MetaMask mobile app automatically switches to the correct network.

The example starts the off-ramp process to sell 125 ETH (`amount=125`) on Linea (chain ID `59144`).

:::note
You can use the `/sell` or `/sell-crypto` path for this deeplink.
:::

### Query string parameters

- `chainId` - (Optional) Chain ID of the network to use.
- `amount` - (Optional) Amount to sell, in the native currency.

---

## SDK introduction

# Seamlessly connect to MetaMask using the SDK

MetaMask SDK enables a fast, reliable, and seamless connection from your dapp to the MetaMask extension and MetaMask mobile app.
With the SDK, you can easily onboard users and interact with their accounts on desktop or mobile, across all EVM networks.

  <Button
    as="a"
    href="/sdk/connect/javascript-wagmi"
    label="Get started with the SDK"
    icon="arrow-right"
    style={{
            '--button-color-hover': 'var(--general-black)',
            '--button-text-color-hover': 'var(--general-white)',
          }}
  />

## Why use the SDK?

MetaMask SDK gives your dapp a powerful upgrade:

- **Cross-platform, cross-browser support** - One integration covers both desktop and mobile, all major browsers, and the MetaMask mobile app—streamlining your user onboarding and eliminating edge cases.
- **Mobile connection that just works** - Say goodbye to clunky "open in in-app browser" flows.
  The SDK enables a native connection from any mobile browser (Safari, Chrome, etc.) directly to the MetaMask mobile app, using secure deeplinking and session management.
- **Production-ready, battle-tested** - MetaMask SDK is used in high-volume dapps across DeFi, NFTs, gaming, and more—ensuring stability, speed, and a smooth developer experience.
- **Multichain-ready by design** - Today, the SDK supports all EVM networks.
  Coming soon: Seamless connection to non-EVM chains like Solana and Bitcoin.
  Futureproof your dapp with a single integration.

## Supported platforms and libraries

MetaMask SDK is available in a variety of ways to make integration as easy as possible.
You can access it directly via npm, through popular developer libraries like Wagmi, or as part of popular convenience libraries.

<CardList
items={[
{
href: '/sdk/connect/javascript-wagmi',
title: 'JavaScript + Wagmi (recommended)',
description: 'Set up the SDK in a Next.js and Wagmi dapp.',
},
{
href: '/sdk/connect/javascript',
title: 'JavaScript',
description: 'Set up the SDK in a JavaScript dapp.',
},
{
href: '/sdk/connect/javascript-rainbowkit',
title: 'JavaScript + RainbowKit',
description: 'Set up the SDK in a JavaScript and RainbowKit dapp.',
},
{
href: '/sdk/connect/javascript-connectkit',
title: 'JavaScript + ConnectKit',
description: 'Set up the SDK in a JavaScript and ConnectKit dapp.',
},
{
href: '/sdk/connect/javascript-dynamic',
title: 'Dynamic SDK',
description: 'Set up Dynamic SDK in a Next.js dapp. Use MetaMask SDK features with Dynamic.',
},
{
href: '/sdk/connect/javascript-web3auth',
title: 'Web3Auth SDK',
description: 'Set up Embedded Wallets SDK in a Next.js dapp. Use MetaMask SDK features with Embedded Wallets.',
},
{
href: '/sdk/connect/react-native',
title: 'React Native',
description: 'Set up the SDK in a React Native or Expo dapp.',
},
{
href: 'https://web3onboard.thirdweb.com',
title: 'Web3-Onboard',
description: 'Use SDK features with Web3-Onboard.',
buttonIcon: 'external-arrow',
}
]}
/>

:::tip Build embedded wallet experiences that work seamlessly with MetaMask
Introducing our latest [Embedded Wallets SDK](connect/javascript-web3auth.md) (Web3Auth), you can now onboard users
instantly and design seamless onchain experiences with social logins and more.
:::

---

## LLM prompt


The following text is a condensed introduction to the MetaMask SDK, for use in an LLM's limited context.
You can copy and paste it into an LLM-based chatbot such as [ChatGPT](https://chatgpt.com/) to provide context about the toolkit.

Copy the following text by selecting the copy icon in the upper right corner of the text block:

````text
You are a helpful assistant with expertise in MetaMask SDK integration.
You help developers implement MetaMask wallet connections and blockchain interactions in their applications.

Core capabilities of the SDK:

- Connect to MetaMask wallet (extension or mobile)
- Read and write data to smart contracts
- Handle blockchain transactions
- Manage network connections
- Work with Web3 standards (EIP-1193, EIP-6963)

Technologies:

- Primary stack (recommended):
  - Wagmi (React hooks for Ethereum)
  - TypeScript
  - React/Next.js
  - Viem (Ethereum interactions)
- Alternative approach:
  - Vanilla JavaScript
  - MetaMask provider API
  - EIP-1193 provider interface

Common patterns:

1. Wallet connection

  Using Wagmi (Recommended):

  ```js

  function Connect() {
    const { connect, connectors } = useConnect()
    return (
      <button onClick={() => connect({ connector: connectors[0] })}>
        Connect Wallet
      </button>
    )
  }
  ```

  Using Vanilla JS:

  ```js
  const provider = window.ethereum;
  const accounts = await provider.request({ 
    method: "eth_requestAccounts" 
  });
  ```

2. Read contract data

  Using Wagmi:

  ```js
  const { data } = useReadContract({
    address: contractAddress,
    abi: contractABI,
    functionName: "balanceOf",
    args: [address],
  })
  ```

  Using Vanilla JS:

  ```js
  const result = await provider.request({
    method: "eth_call",
    params: [{
      to: contractAddress,
      data: encodedFunctionData,
    }],
  });
  ```

3. Write to contracts

  Using Wagmi:

  ```js
  const { writeContract } = useWriteContract();
  await writeContract({
    address: contractAddress,
    abi: contractABI,
    functionName: "mint",
    args: [tokenId],
  })
  ```

  Using Vanilla JS:

  ```js
  await provider.request({
    method: "eth_sendTransaction",
    params: [{
      to: contractAddress,
      data: encodedFunctionData,
    }],
  });
  ```

Best practices:

- Always handle errors gracefully
- Show clear loading states
- Track transaction status
- Validate inputs and addresses
- Use appropriate gas settings
- Consider mobile wallet interactions

Assistant response guidelines:
When answering questions:

- Prefer Wagmi examples unless vanilla JS is specifically requested
- Include error handling in examples
- Consider both web and mobile wallet scenarios
- Provide TypeScript types where relevant
- Include brief explanations with code examples
- Consider security implications

Example usage:
I (the user) can ask questions like:

- "How do I connect to MetaMask?"
- "How do I read a token balance?"
- "How do I send a transaction?"
- "How do I handle network changes?"
- "How do I implement wallet disconnection?"
- "How do I add error handling for contract calls?"

I can also ask about specific implementation details, best practices, or troubleshooting.
````

---

## SDK methods


MetaMask SDK provides several convenience methods for connecting to and interacting with MetaMask, including the following.

## `connect`

Connects to MetaMask and requests account access.

### Returns

A promise that resolves to an array of account addresses.

### Example

```javascript
const accounts = await sdk.connect();
console.log("Connected accounts:", accounts);
```

## `connectAndSign`

Connects to MetaMask and signs a message in a single operation.

### Parameters

- `msg`: `string` - The message to sign.

### Returns

A promise that resolves to the signature of the signed message.

### Example

```javascript
const signature = await sdk.connectAndSign({ 
  msg: "Hello from my dapp!" 
});
console.log("Signature:", signature);
```

## `connectWith`

Connects to MetaMask and executes a specific [JSON-RPC method](/wallet/reference/json-rpc-methods).

### Parameters

- `rpc`: `object` - The RPC method to execute.
  - `method`: `string` - The RPC method name.
  - `params`: `any[]` - The parameters for the RPC method.

### Returns

A promise that resolves to the result of the RPC call.

### Example

```javascript
const result = await sdk.connectWith({
  rpc: {
    method: "eth_getBalance",
    params: ["0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6", "latest"]
  }
});
console.log("Balance:", result);
```

## `getProvider`

Returns the active Ethereum provider object.

### Returns

The active provider, or undefined if no provider is found.

### Example

```javascript
const provider = sdk.getProvider();
if (provider) {
  // Use the provider for RPC calls
  const accounts = await provider.request({
    method: "eth_requestAccounts"
  });
}
```

## `isInitialized`

Checks if the SDK has been initialized.

### Returns

`True` if the SDK is initialized, `false` otherwise.

### Example

```javascript
if (sdk.isInitialized()) {
  console.log("SDK is ready to use");
}
```

## `terminate`

Terminates the MetaMask connection, switching back to the injected provider if connected via extension.

:::note
The `disconnect()` SDK method is deprecated.
Use `terminate()` instead.
:::

### Example

```javascript
await sdk.terminate();
console.log("Connection terminated");
```

---

## SDK options


MetaMask SDK takes the following configuration options.

### `checkInstallationImmediately`

<Tabs>
<TabItem value="Syntax">

```javascript
checkInstallationImmediately: <boolean>
```

</TabItem>
<TabItem value="Example">

```javascript
checkInstallationImmediately: true
```

</TabItem>
</Tabs>

Enables or disables immediately checking if MetaMask is installed on the user's browser.
If `true`, the SDK checks for installation upon page load and sends a connection request, prompting
the user to install MetaMask if it's not already installed.
If `false`, the SDK waits for the connect method to be called to check for installation.

The default is `false`.

### `checkInstallationOnAllCalls`

<Tabs>
<TabItem value="Syntax">

```javascript
checkInstallationOnAllCalls: <boolean>
```

</TabItem>
<TabItem value="Example">

```javascript
checkInstallationOnAllCalls: true
```

</TabItem>
</Tabs>

Enables or disables checking if MetaMask is installed on the user's browser before each RPC request.
The default is `false`.

### `communicationServerUrl`

<Tabs>
<TabItem value="Syntax">

```javascript
communicationServerUrl: <string>
```

</TabItem>
<TabItem value="Example">

```javascript
communicationServerUrl: "https://metamask-sdk-socket.metafi.codefi.network/"
```

</TabItem>
</Tabs>

The URL of the communication server to use.
This option is mainly used for debugging and testing the SDK.

### `dappMetadata`

<Tabs>
<TabItem value="Syntax">

```javascript
dappMetadata: {
  name: <string>,
  url: <string>,
  iconUrl: <string>,
}
```

</TabItem>
<TabItem value="Example">

```javascript
dappMetadata: {
  name: "My Dapp",
  url: "https://mydapp.com",
  iconUrl: "https://mydapp.com/icon.png",
}
```

</TabItem>
</Tabs>

Metadata about the dapp using the SDK.
The metadata options are:

- `name` - Name of the dapp
- `url` - URL of the dapp
- `iconUrl` - URL of the dapp's icon

:::tip important
Setting `dappMetaData` creates a clear and trustworthy user experience when connecting your dapp to the
MetaMask mobile app.
MetaMask displays this metadata in the connection modal to help users identify and verify the
connection request.
:::

### `enableAnalytics`

<Tabs>
<TabItem value="Syntax">

```javascript
enableAnalytics: <boolean>
```

</TabItem>
<TabItem value="Example">

```javascript
enableAnalytics: true
```

</TabItem>
</Tabs>

Enables or disables sending anonymous analytics to MetaMask to help improve the SDK.
The default is `true`.

### `extensionOnly`

<Tabs>
<TabItem value="Syntax">

```javascript
extensionOnly: <boolean>
```

</TabItem>
<TabItem value="Example">

```javascript
extensionOnly: true
```

</TabItem>
</Tabs>

Enables or disables automatically using the MetaMask browser extension if it's detected.
The default is `true`.

### `infuraAPIKey`

<Tabs>
<TabItem value="Syntax">

```javascript
infuraAPIKey: <string>
```

</TabItem>
<TabItem value="Example">

```javascript
infuraAPIKey: process.env.INFURA_API_KEY
```

</TabItem>
</Tabs>

The [Infura API key](/developer-tools/dashboard/get-started/create-api) to
use for RPC requests.
Configure this option to make read-only RPC requests from your dapp.

:::caution important
Use [Infura allowlists](/developer-tools/dashboard/how-to/secure-an-api/use-an-allowlist)
to protect against other people submitting requests to your API key.
You can restrict interactions to specific addresses, origins, user agents, and request methods.
We recommend using all allowlist options to maximize the security of your API key and dapp.
:::

### `headless`

<Tabs>
<TabItem value="Syntax">

```javascript
headless: <boolean>
```

</TabItem>
<TabItem value="Example">

```javascript
headless: true
```

</TabItem>
</Tabs>

Enables or disables headless mode.
Setting this to `true` allows you to display custom modals.
The default is `false`.

### `openDeeplink`

<Tabs>
<TabItem value="Syntax">

```javascript
openDeeplink: <function>
```

</TabItem>
<TabItem value="Example">

```javascript
openDeeplink: (link: string) => {
  if (canOpenLink) {
    Linking.openURL(link);
  }
}
```

</TabItem>
</Tabs>

A function that is called to open a deeplink to the MetaMask mobile app.

### `readonlyRPCMap`

<Tabs>
<TabItem value="Syntax">

```javascript
readonlyRPCMap: <map>
```

</TabItem>
<TabItem value="Example">

```javascript
readonlyRPCMap: {
  "0x539": "http://localhost:8545",
}
```

</TabItem>
</Tabs>

A map of RPC URLs to use for read-only RPC requests.

### `shouldShimWeb3`

<Tabs>
<TabItem value="Syntax">

```javascript
shouldShimWeb3: <boolean>
```

</TabItem>
<TabItem value="Example">

```javascript
shouldShimWeb3: false
```

</TabItem>
</Tabs>

Enables or disables shimming the `window.web3` object with the Ethereum provider returned by the SDK
(useful for compatibility with older browsers).
The default is `true`.

---

## Supported platforms


With MetaMask SDK, you can connect your dapp to MetaMask in the following ways:

- **Desktop web dapps** - Automatically connect to the MetaMask extension, or connect to the MetaMask mobile app using a QR code.

- **Mobile dapps** - The SDK generates a deeplink that takes users directly to the MetaMask mobile app.

The following table expands on the SDK's connection methods:

| Dapp location | User wallet location | Connection method | MetaMask SDK | Other SDKs |
|---------------|-------------|------------------|--------------------------|--------------------------|
| Desktop web | Wallet browser extension | Automatic connection via browser extension | Supported | Supported |
| Desktop web | Wallet mobile app | QR code scan with wallet mobile app | Supported | Limited |
| Mobile browser | Wallet mobile app | Deeplink directly to wallet mobile app | Supported | Limited |
| Mobile dapp | Wallet mobile app | Deeplink directly to wallet mobile app | Supported | Limited |

:::tip 
For a better user experience on mobile, it's important to use reliable RPC providers instead of public nodes.
We recommend using services like [MetaMask Developer](https://developer.metamask.io/) to ensure better reliability and performance.
:::