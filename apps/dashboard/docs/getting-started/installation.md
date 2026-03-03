# Installation

Detailed installation instructions for Crypto Data Aggregator.

## System Requirements

| Requirement | Minimum | Recommended |
| ----------- | ------- | ----------- |
| Node.js     | 18.17+  | 20.x LTS    |
| npm         | 9.x     | 10.x        |
| RAM         | 2 GB    | 4 GB        |
| Disk        | 500 MB  | 1 GB        |

## Installation Methods

=== "npm"

    ```bash
    git clone https://github.com/nirholas/crypto-data-aggregator.git
    cd crypto-data-aggregator
    npm install
    ```

=== "pnpm"

    ```bash
    git clone https://github.com/nirholas/crypto-data-aggregator.git
    cd crypto-data-aggregator
    pnpm install
    ```

=== "yarn"

    ```bash
    git clone https://github.com/nirholas/crypto-data-aggregator.git
    cd crypto-data-aggregator
    yarn install
    ```

## Docker Installation

```bash
# Build the image
docker build -t crypto-aggregator .

# Run the container
docker run -p 3000:3000 \
  -e X402_PAY_TO_ADDRESS=0xYourAddress \
  crypto-aggregator
```

## Development Setup

For contributors and developers:

```bash
# Clone with full history
git clone https://github.com/nirholas/crypto-data-aggregator.git
cd crypto-data-aggregator

# Install dependencies
npm install

# Set up Git hooks
npm run prepare

# Copy environment template
cp .env.example .env.local

# Start development server
npm run dev
```

## Verify Installation

```bash
# Check Next.js builds correctly
npm run build

# Run tests
npm test

# Run linting
npm run lint
```

## Next Steps

- [Configuration](configuration.md) - Set up environment variables
- [Development Guide](../guides/development.md) - Start contributing
