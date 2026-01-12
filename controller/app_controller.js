import { prisma } from "../util/prisma_config.js"
import { ethers, keccak256, toUtf8Bytes, NonceManager } from "ethers";
import axios from "axios";
import { chat } from "./agent_service.js";
import FormData from "form-data";


export const registerCreator = async (req, res) => {
    const { walletAddress } = req.body;

    if (!walletAddress) {
        return res.status(400).json({ error: 'Data walletAddress harus diisi.' });
    }

    try {
        const newUser = await prisma.creator.create({
            data: {
                walletAddress: walletAddress
            },
        });

        // Format response 
        const responseData = {
            id: newUser.id,
            walletAddress: newUser.walletAddress,
        };

        return res.status(200).json(responseData);

    } catch (error) {
        // Penanganan error Unique Constraint
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'Profile sudah terdaftar (Wallet Address).' });
        }

        console.error('Error saat membuat creator', error);
        return res.status(500).json({ error: 'Terjadi kesalahan server.' });
    }
};

export const getProfile = async (req, res) => {
    const { id } = req.params;
    try {
        const assets = await prisma.creator.findFirst({
            where: { id: parseInt(id) },
        });

        return res.status(200).json(assets);
    } catch (error) {
        console.error("Error fetching id:", error);
        return res.status(500).json({
            message: "Internal Server Error",
        });
    }
};

export const getCreatorAll = async (req, res) => {
    try {
        const assets = await prisma.creator.findMany({
            orderBy: { walletAddress: 'desc' },
        });

        return res.status(200).json(assets);
    } catch (error) {
        console.error("Error fetching id:", error);
        return res.status(500).json({
            message: "Internal Server Error",
        });
    }
}

export const getCreatorWrapped = async (req, res) => {
    const { idCreator } = req.params;
    try {
        const wrapped = await prisma.wrappedData.findMany({
            where: { creatorId: parseInt(idCreator) },
        });

        if (wrapped.length === 0) {
            return res.status(404).json({
                message: "No wrapped data found for this creator",
            });
        }

        return res.status(200).json(wrapped);
    } catch (error) {
        console.error("Error fetching wrapped:", error);
        return res.status(500).json({
            message: "Internal Server Error",
        });
    }
};

export const createWrapped = async (req, res) => {
    try {
        const { originalUrl,urlImage, methods, gatewaySlug, header, body, paymentAmount, paymentReceipt, description } = req.body;
        const { creatorId } = req.params;
        if (
            !urlImage ||
            !originalUrl ||
            !methods ||
            !gatewaySlug ||
            !paymentAmount ||
            !paymentReceipt ||
            !description
            || creatorId === undefined
        ) {
            return res.status(400).json({
                message: "Missing required fields",
            });
        }

        // let parts = originalUrl.split('/');
        // parts.pop(); 
        const baseurl = `${req.protocol}://${req.get('host')}`;
        const newUrl = `${baseurl}/${gatewaySlug}`;

        // Simpan ke database
        await prisma.wrappedData.create({
            data: {
                originalUrl: originalUrl,
                methods: methods,
                gatewaySlug: gatewaySlug,
                header: header,
                body: body,
                paymentAmount: paymentAmount,
                paymentReceipt: paymentReceipt,
                description: description,
                creatorId: parseInt(creatorId),
                urlWrapped: newUrl,
                icon: urlImage
            },
        });

        return res.status(201).json({
            message: "success",
            newUrl: newUrl
        });
    } catch (error) {
        console.error("Error creating asset:", error);

        if (error.code === "P2002") {
            return res.status(500).json({
                message: "gatewaySlug already exists",
            });
        }

        return res.status(500).json({
            message: "Internal Server Error",
        });
    }
};

export const getPayroute = async (req, res) => {
    try {
        const { gatewaySlug } = req.params;
        const wrapped = await prisma.wrappedData.findUnique({
            where: { gatewaySlug }
        });

        if (!wrapped) {
            return res.status(404).json({
                message: "Wrapped data not found",
            });
        }

        const { originalUrl, methods, paymentReceipt, paymentAmount } = wrapped;
        const requestMethod = req.method.toUpperCase();
        if (!methods.includes(requestMethod)) {
            return res.status(405).json({
                message: "Method not allowed",
            });
        }

        const paymentTx = req.headers['x-payment-tx'];
        if (paymentTx) {
            const txHash = paymentTx.replace('Bearer ', '');

            // Onchain Verification
            const musdAddress = process.env.MUSD_ADDRESS;
            const rpcUrl = process.env.MANTLE_TESTNET_RPC_URL;
            const provider = new ethers.JsonRpcProvider(rpcUrl);

            try {
                const tx = await provider.getTransaction(txHash);

                if (!tx) {
                    return res.status(402).json({ message: "Transaction not found" });
                }

                if (!tx.blockNumber) {
                    return res.status(402).json({ message: "Transaction pending" });
                }

                // Verify Interaction with MUSD Contract
                if (tx.to.toLowerCase() !== musdAddress.toLowerCase()) {
                    return res.status(402).json({
                        message: "Transaction is not to MUSD contract",
                        expected: musdAddress,
                        received: tx.to
                    });
                }

                // Decode ERC20 Transfer
                const erc20Interface = new ethers.Interface([
                    "function transfer(address to, uint256 amount)"
                ]);

                let decodedData;
                try {
                    decodedData = erc20Interface.decodeFunctionData("transfer", tx.data);
                } catch (err) {
                    return res.status(402).json({ message: "Invalid transaction data (not transfer)" });
                }

                const recipient = decodedData[0];
                const amount = decodedData[1];

                // Verify Recipient
                if (recipient.toLowerCase() !== paymentReceipt.toLowerCase()) {
                    return res.status(402).json({
                        message: "Invalid payment recipient",
                        expected: paymentReceipt,
                        received: recipient
                    });
                }

                // Verify Amount
                // Assuming paymentAmount is standard float (e.g. 1.5) and MUSD uses 6 decimals
                const expectedAmount = ethers.parseUnits(paymentAmount.toString(), 6);

                if (amount < expectedAmount) {
                    return res.status(402).json({
                        message: "Insufficient payment amount",
                        expected: paymentAmount.toString(),
                        received: ethers.formatUnits(amount, 6)
                    });
                }

            } catch (error) {
                console.error("Verification error:", error);
                return res.status(402).json({ message: "Payment verification failed" });
            }

            const response = await axios(originalUrl, {
                method: requestMethod,
                // headers: req.headers,
                // data: req.body,
                validateStatus: () => true // Handle status manually
            });

            return res.status(response.status).json(response.data);
        } else {
            // create transaction in DB
            let dbTx;
            const txId = keccak256(
                toUtf8Bytes(
                    `${paymentReceipt}-${gatewaySlug}-${paymentAmount}-${Date.now()}`
                )
            );

            try {
                dbTx = await prisma.transactions.create({
                    data: {
                        id: txId,
                        creatorWallet: paymentReceipt,
                        gatewaySlug: gatewaySlug,
                        amount: paymentAmount,
                        status: "PENDING"
                    }
                });
            } catch (dbError) {
                console.error("Error saving transaction to DB:", dbError);
                return res.status(500).json({
                    message: "Internal Server Error",
                });
            }

            return res.status(402).json({
                message: "Payment Required",
                receiverAddress: paymentReceipt,
                transactionId: dbTx.id,
                escrowAddress: process.env.ESCROW_ADDRESS,
                amount: paymentAmount,
                currency: "MUSD",
                chain: "MANTLE TESTNET",
                requiredHeader: "x-payment-tx"
            });
        }


    } catch (error) {
        console.error("Error fetching payroute:", error);
        return res.status(500).json({
            message: "Internal Server Error",
        });
    }
};

export const getPayrouteWithEscrow = async (req, res) => {
    try {
        const { gatewaySlug } = req.params;
        const wrapped = await prisma.wrappedData.findUnique({
            where: { gatewaySlug }
        });

        if (!wrapped) {
            return res.status(404).json({
                message: "Wrapped data not found",
            });
        }

        const { originalUrl, methods, paymentReceipt, paymentAmount } = wrapped;
        const requestMethod = req.method.toUpperCase();
        if (!methods.includes(requestMethod)) {
            return res.status(405).json({
                message: `Method ${requestMethod} not allowed`,
            });
        }

        const paymentTx = req.headers['x-payment-tx'];

        if (paymentTx) {

            // Verify Payment
            const txHash = paymentTx.replace('Bearer ', '');

            // Onchain component
            const escrowAddress = process.env.ESCROW_ADDRESS;
            const privateKey = process.env.PRIVATE_KEY;
            const rpcUrl = process.env.MANTLE_TESTNET_RPC_URL;
            const provider = new ethers.JsonRpcProvider(rpcUrl);
            const rawWallet = new ethers.Wallet(privateKey, provider);
            const wallet = new NonceManager(rawWallet);

            // ABI for decoding createTx and calling finalize
            const escrowInterface = new ethers.Interface([
                "function createTx(bytes32 txId, address creator, uint256 amount)",
                "function finalizeSuccess(bytes32 txId) external",
                "function finalizeFailure(bytes32 txId) external"
            ]);

            const escrowContract = new ethers.Contract(escrowAddress, [
                "function finalizeSuccess(bytes32 txId) external",
                "function finalizeFailure(bytes32 txId) external"
            ], wallet);

            let decodedTxId;
            let decodedAmount;

            try {
                // Verify Payment
                const tx = await provider.getTransaction(txHash);

                if (!tx) {
                    return res.status(402).json({ message: "Transaction not found" });
                }

                if (!tx.blockNumber) {
                    return res.status(402).json({ message: "Transaction pending" });
                }

                // Verify Input data on createTx method excrow
                // decodeFunctionData returns Result object which is array-like
                const decodedData = escrowInterface.decodeFunctionData("createTx", tx.data);
                const txId = decodedData[0]; // bytes32
                const creator = decodedData[1]; // address
                decodedAmount = decodedData[2]; // uint256

                decodedTxId = txId;

                // Check existing txId on Db
                const dbTx = await prisma.transactions.findUnique({
                    where: { id: txId }
                });

                if (!dbTx) {
                    return res.status(402).json({ message: "Transaction ID not found in database" });
                }

                if (creator.toLowerCase() !== dbTx.creatorWallet.toLowerCase()) {
                    return res.status(402).json({
                        message: "Invalid payment recipient in transaction",
                        expected: dbTx.creatorWallet,
                        received: creator
                    });
                }

                // Verify Amount
                // paymentAmount is Float (e.g. 1.5). mUSDC usually 6 decimals.
                const expectedAmount = ethers.parseUnits(paymentAmount.toString(), 6);
                if (decodedAmount < expectedAmount) {
                    return res.status(402).json({
                        message: "Insufficient payment amount",
                        expected: paymentAmount.toString(),
                        received: ethers.formatUnits(decodedAmount, 6)
                    });
                }

            } catch (error) {
                console.error("Verification error:", error);
                return res.status(402).json({ message: "Payment verification failed" });
            }

            // Forward Request to originalUrl
            try {
                const response = await axios(originalUrl, {
                    method: requestMethod,
                    // headers: req.headers,
                    // data: req.body,
                    validateStatus: () => true // Handle status manually
                });

                if (response.status >= 200 && response.status < 300) {
                    // Success - Finalize Success
                    console.log(`Forwarding success. Finalizing Escrow ${decodedTxId} to SUCCESS...`);

                    // Approve token before finalizing 
                    const musdAddress = process.env.MUSD_ADDRESS;
                    const tokenContract = new ethers.Contract(musdAddress, ["function approve(address spender, uint256 amount) external returns (bool)"], wallet);

                    // Note: We are approving the Escrow Contract to spend OUR (Executor's) tokens.
                    const amountToApprove = decodedAmount;

                    try {
                        const approveTx = await tokenContract.approve(escrowAddress, amountToApprove);
                        console.log(`Approval tx sent: ${approveTx.hash}`);
                        await approveTx.wait();
                        console.log("Approval confirmed.");
                    } catch (appErr) {
                        console.error("Approval failed:", appErr);
                        return res.status(500).json({ message: "Token Approval Failed" });
                    }

                    const tx = await escrowContract.finalizeSuccess(decodedTxId);
                    await tx.wait(); // Wait for confirmation
                    console.log(`Finalized Escrow ${decodedTxId} to SUCCESS.`);

                    return res.status(response.status).json(response.data);
                } else {
                    // Failure from upstream - Finalize Failure (Refund)
                    console.log(`Forwarding failed (${response.status}). Finalizing Escrow ${decodedTxId} to FAILED...`);
                    const tx = await escrowContract.finalizeFailure(decodedTxId);
                    await tx.wait();

                    console.log(`Finalized Escrow ${decodedTxId} to FAILED.`);

                    return res.status(response.status).json(response.data);
                }

            } catch (error) {
                console.error("Forwarding error:", error);
                // Network error or other issue
                if (decodedTxId) {
                    console.log(`Forwarding exception. Finalizing Escrow ${decodedTxId} to FAILED...`);
                    try {
                        const tx = await escrowContract.finalizeFailure(decodedTxId);
                        await tx.wait();
                    } catch (finalizeError) {
                        console.error("Error finalizing failure:", finalizeError);
                    }
                }
                return res.status(502).json({ message: "Bad Gateway / Upstream Error" });
            }

        } else {
            // create transaction in DB
            let dbTx;
            const txId = keccak256(
                toUtf8Bytes(
                    `${paymentReceipt}-${gatewaySlug}-${paymentAmount}-${Date.now()}`
                )
            );

            try {
                dbTx = await prisma.transactions.create({
                    data: {
                        id: txId,
                        creatorWallet: paymentReceipt,
                        gatewaySlug: gatewaySlug,
                        amount: paymentAmount,
                        status: "PENDING"
                    }
                });
            } catch (dbError) {
                console.error("Error saving transaction to DB:", dbError);
                return res.status(500).json({
                    message: "Internal Server Error",
                });
            }

            // --- No Payment Evidence ---
            return res.status(402).json({
                message: "Payment Required",
                receiverAddress: paymentReceipt,
                transactionId: dbTx.id,
                escrowAddress: process.env.ESCROW_ADDRESS,
                amount: paymentAmount,
                currency: "MUSD",
                chain: "MANTLE TESTNET",
                requiredHeader: "x-payment-tx"
            });
        }

    } catch (error) {
        console.error("Error fetching wrapped:", error);
        return res.status(500).json({
            message: "Internal Server Error",
        });
    }
};

// --- Agent Management ---

// 1. Create Agent
export const createAgent = async (req, res) => {
    try {
        const { creatorId } = req.params;
        const { name, slug, description, modelProvider, modelName, systemPrompt, pricePerHit, isActive } = req.body;

        if (!creatorId || !name || !slug || !modelProvider || !modelName || !systemPrompt) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        const agent = await prisma.aIAgents.create({
            data: {
                creatorId: parseInt(creatorId),
                name,
                slug,
                description: description || "",
                modelProvider, // "openai", "anthropic", etc.
                modelName,
                systemPrompt,
                pricePerHit: parseFloat(pricePerHit) || 0,
                isActive: isActive !== undefined ? isActive : true
            }
        });

        return res.status(201).json(agent);

    } catch (error) {
        console.error("Error creating agent:", error);
        if (error.code === 'P2002') { // Slug unique
            return res.status(409).json({ message: "Agent slug already exists" });
        }
        return res.status(500).json({ message: "Internal Server Error" });
    }
};

// 2. List Creator Agents
export const getCreatorAgents = async (req, res) => {
    try {
        const { creatorId } = req.params;
        const agents = await prisma.aIAgents.findMany({
            where: { creatorId: parseInt(creatorId) },
            orderBy: { createdAt: 'desc' }
        });
        return res.status(200).json(agents);
    } catch (error) {
        console.error("Error fetching creator agents:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};

// 3. Get Agent Details
export const getAgentDetails = async (req, res) => {
    try {
        const { agentId } = req.params;
        const agent = await prisma.aIAgents.findUnique({
            where: { id: agentId },
            include: { resources: true } // Include resources if needed, or mapped resources
        });

        if (!agent) {
            return res.status(404).json({ message: "Agent not found" });
        }
        return res.status(200).json(agent);
    } catch (error) {
        console.error("Error fetching agent:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};

// 1. Create Agent Resource
export const createAgentResource = async (req, res) => {
    try {
        const { creatorId } = req.params;
        const { type, title, content, metadata } = req.body; // type: TEXT, LINK, SMART_CONTRACT

        if (!creatorId || !type || !title || !content) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        const resource = await prisma.agentResource.create({
            data: {
                creatorId: parseInt(creatorId),
                type,
                title,
                content,
                metadata: metadata || {}
            }
        });

        return res.status(201).json(resource);
    } catch (error) {
        console.error("Error creating agent resource:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};

// 2. List Creator Resources
export const getCreatorResources = async (req, res) => {
    try {
        const { creatorId } = req.params;

        const resources = await prisma.agentResource.findMany({
            where: { creatorId: parseInt(creatorId) },
            orderBy: { createdAt: 'desc' }
        });

        return res.status(200).json(resources);
    } catch (error) {
        console.error("Error fetching creator resources:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};

// 3. Attach Resource to Agent
export const attachResourceToAgent = async (req, res) => {
    try {
        const { agentId } = req.params;
        const { resourceId } = req.body;

        if (!agentId || !resourceId) {
            return res.status(400).json({ message: "Missing agentId or resourceId" });
        }

        // Check duplicates if needed? Prisma throws error on duplicate PK
        const linkage = await prisma.agentResourceMap.create({
            data: {
                agentId,
                resourceId
            }
        });

        return res.status(201).json({ message: "Resource attached", linkage });
    } catch (error) {
        console.error("Error attaching resource:", error);
        if (error.code === 'P2002') { // Unique constraint
            return res.status(409).json({ message: "Resource already attached" });
        }
        return res.status(500).json({ message: "Internal Server Error" });
    }
};

// 4. View Resources used by Agent
export const getAgentResources = async (req, res) => {
    try {
        const { agentId } = req.params;

        const maps = await prisma.agentResourceMap.findMany({
            where: { agentId },
            include: {
                resource: true
            }
        });

        // Flatten result
        const resources = maps.map(m => m.resource);

        return res.status(200).json(resources);
    } catch (error) {
        console.error("Error fetching agent resources:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};

// 5. Detach Resource from Agent
export const detachResourceFromAgent = async (req, res) => {
    try {
        const { agentId, resourceId } = req.params;

        await prisma.agentResourceMap.delete({
            where: {
                agentId_resourceId: {
                    agentId,
                    resourceId
                }
            }
        });

        return res.status(200).json({ message: "Resource detached" });
    } catch (error) {
        console.error("Error detaching resource:", error);
        if (error.code === 'P2025') { // Rec not found
            return res.status(404).json({ message: "Linkage not found" });
        }
        return res.status(500).json({ message: "Internal Server Error" });
    }
};

export const escrowCallAIChat = async (req, res) => {
    try {
        const { agentSlug } = req.params;
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({ error: "Message is required" });
        }

        // Fetch Agent details including creator for wallet address
        const agent = await prisma.aIAgents.findUnique({
            where: { slug: agentSlug },
            include: { creator: true }
        });

        if (!agent) {
            return res.status(404).json({ error: "Agent not found" });
        }

        const pricePerHit = agent.pricePerHit;
        const paymentReceipt = agent.creator.walletAddress;

        // If price is 0, skip payment logic ?? OR enforce empty transaction? 
        // Assuming we always enforcement payment flow for consistency if price > 0, 
        // but if price is 0 maybe allow free access? 
        // For now, let's implement the payment flow if price > 0.

        if (pricePerHit > 0) {
            const paymentTx = req.headers['x-payment-tx'];

            if (paymentTx) {
                // Verify Payment
                const txHash = paymentTx.replace('Bearer ', '');

                // Onchain component
                const escrowAddress = process.env.ESCROW_ADDRESS;
                const privateKey = process.env.PRIVATE_KEY;
                const rpcUrl = process.env.MANTLE_TESTNET_RPC_URL;
                const provider = new ethers.JsonRpcProvider(rpcUrl);
                const rawWallet = new ethers.Wallet(privateKey, provider);
                const wallet = new NonceManager(rawWallet);

                // ABI for decoding createTx and calling finalize
                const escrowInterface = new ethers.Interface([
                    "function createTx(bytes32 txId, address creator, uint256 amount)",
                    "function finalizeSuccess(bytes32 txId) external",
                    "function finalizeFailure(bytes32 txId) external"
                ]);

                const escrowContract = new ethers.Contract(escrowAddress, [
                    "function finalizeSuccess(bytes32 txId) external",
                    "function finalizeFailure(bytes32 txId) external"
                ], wallet);

                let decodedTxId;
                let decodedAmount;

                try {
                    // Verify Payment
                    const tx = await provider.getTransaction(txHash);

                    if (!tx) {
                        return res.status(402).json({ message: "Transaction not found" });
                    }

                    if (!tx.blockNumber) {
                        return res.status(402).json({ message: "Transaction pending" });
                    }

                    // Verify Input data on createTx method excrow
                    const decodedData = escrowInterface.decodeFunctionData("createTx", tx.data);
                    const txId = decodedData[0]; // bytes32
                    const creator = decodedData[1]; // address
                    decodedAmount = decodedData[2]; // uint256

                    decodedTxId = txId;

                    // Check existing txId on Db to ensure it's not reused or fake if we were tracking strict content access, 
                    // but here we just need to ensure the pending transaction matches parameters.
                    // Ideally we should check if this txId is already "FINALIZED" to prevent replay attacks.
                    // For now, let's check strict status PENDING
                    const dbTx = await prisma.transactions.findUnique({
                        where: { id: txId }
                    });

                    if (!dbTx) {
                        // It might be a direct call not initiated via our 402 response? 
                        // But providing a robust system, we expect the client to have received the 402 first which created the DB entry.
                        return res.status(402).json({ message: "Transaction ID not found in database" });
                    }

                    if (dbTx.status !== "PENDING") {
                        return res.status(402).json({ message: "Transaction already processed" });
                    }

                    if (creator.toLowerCase() !== paymentReceipt.toLowerCase()) {
                        return res.status(402).json({
                            message: "Invalid payment recipient in transaction",
                            expected: paymentReceipt,
                            received: creator
                        });
                    }

                    // Verify Amount
                    const expectedAmount = ethers.parseUnits(pricePerHit.toString(), 6);
                    if (decodedAmount < expectedAmount) {
                        return res.status(402).json({
                            message: "Insufficient payment amount",
                            expected: pricePerHit.toString(),
                            received: ethers.formatUnits(decodedAmount, 6)
                        });
                    }

                } catch (error) {
                    console.error("Verification error:", error);
                    return res.status(402).json({ message: "Payment verification failed" });
                }

                // --- Execute AI Chat ---
                try {
                    // Fetch Agent Resources
                    const maps = await prisma.agentResourceMap.findMany({
                        where: { agentId: agent.id },
                        include: {
                            resource: true
                        }
                    });

                    const resources = maps.map(m => m.resource);

                    // Construct Prompt
                    let finalPrompt = "";

                    // 1. Add System Prompt
                    if (agent.systemPrompt) {
                        finalPrompt += `System Prompt: ${agent.systemPrompt}\n\n`;
                    }

                    // 2. Add Resources Context
                    if (resources.length > 0) {
                        const context = resources.map(r => `Title: ${r.title}\nContent: ${r.content}`).join("\n\n");
                        finalPrompt += `Context information is below.\n---------------------\n${context}\n---------------------\nGiven the context information and not prior knowledge, answer the query.\n`;
                    }

                    // 3. Add User Message
                    finalPrompt += `Query: ${message}`;

                    const response = await chat(finalPrompt);

                    // --- Success: Finalize Payment ---
                    console.log(`AI Chat success. Finalizing Escrow ${decodedTxId} to SUCCESS...`);

                    // Approve token before finalizing 
                    const musdAddress = process.env.MUSD_ADDRESS;
                    const tokenContract = new ethers.Contract(musdAddress, ["function approve(address spender, uint256 amount) external returns (bool)"], wallet);

                    // Note: We are approving the Escrow Contract to spend OUR (Executor's) tokens.
                    const amountToApprove = decodedAmount;

                    try {
                        const approveTx = await tokenContract.approve(escrowAddress, amountToApprove);
                        console.log(`Approval tx sent: ${approveTx.hash}`);
                        await approveTx.wait();
                        console.log("Approval confirmed.");
                    } catch (appErr) {
                        console.error("Approval failed:", appErr);
                        // If approval fails, we might technically initiate a refund or retry, 
                        // but for now let's error out. AI response was generated though.
                        return res.status(500).json({ message: "Token Approval Failed" });
                    }

                    const tx = await escrowContract.finalizeSuccess(decodedTxId);
                    await tx.wait();
                    console.log(`Finalized Escrow ${decodedTxId} to SUCCESS.`);

                    // Mark DB as success
                    await prisma.transactions.update({
                        where: { id: decodedTxId },
                        data: { status: "SUCCESS" }
                    });

                    return res.status(200).json({ response });

                } catch (error) {
                    // --- Failure: Refund ---
                    console.error("AI Generation error:", error);

                    if (decodedTxId) {
                        console.log(`AI Error. Finalizing Escrow ${decodedTxId} to FAILED...`);
                        try {
                            const tx = await escrowContract.finalizeFailure(decodedTxId);
                            await tx.wait();

                            // Mark DB as failed
                            await prisma.transactions.update({
                                where: { id: decodedTxId },
                                data: { status: "FAILED" }
                            });

                        } catch (finalizeError) {
                            console.error("Error finalizing failure:", finalizeError);
                        }
                    }
                    return res.status(500).json({ error: "AI Processing Failed" });
                }

            } else {
                // --- 402 Payment Required ---

                // create transaction in DB
                let dbTx;
                const txId = keccak256(
                    toUtf8Bytes(
                        `${paymentReceipt}-${agent.slug}-${pricePerHit}-${Date.now()}`
                    )
                );

                try {
                    dbTx = await prisma.transactions.create({
                        data: {
                            id: txId,
                            creatorWallet: paymentReceipt,
                            gatewaySlug: agent.slug, // Use agent slug as gateway slug identifier
                            amount: pricePerHit,
                            status: "PENDING"
                        }
                    });
                } catch (dbError) {
                    console.error("Error saving transaction to DB:", dbError);
                    return res.status(500).json({
                        message: "Internal Server Error",
                    });
                }

                return res.status(402).json({
                    message: "Payment Required",
                    receiverAddress: paymentReceipt,
                    transactionId: dbTx.id,
                    escrowAddress: process.env.ESCROW_ADDRESS,
                    amount: pricePerHit,
                    currency: "MUSD",
                    chain: "MANTLE TESTNET",
                    requiredHeader: "x-payment-tx"
                });
            }

        } else {
            // Free agent logic
            // Fetch Agent Resources
            const maps = await prisma.agentResourceMap.findMany({
                where: { agentId: agent.id },
                include: {
                    resource: true
                }
            });

            const resources = maps.map(m => m.resource);

            // Construct Prompt
            let finalPrompt = "";

            if (agent.systemPrompt) {
                finalPrompt += `System Prompt: ${agent.systemPrompt}\n\n`;
            }

            if (resources.length > 0) {
                const context = resources.map(r => `Title: ${r.title}\nContent: ${r.content}`).join("\n\n");
                finalPrompt += `Context information is below.\n---------------------\n${context}\n---------------------\nGiven the context information and not prior knowledge, answer the query.\n`;
            }

            finalPrompt += `Query: ${message}`;

            const response = await chat(finalPrompt);
            return res.status(200).json({ response });
        }

    } catch (error) {
        console.error("Error in callAIChat:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}

export const callAIChat = async (req, res) => {
    try {
        const { agentSlug } = req.params;
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({ error: "Message is required" });
        }

        // Fetch Agent details including creator for wallet address
        const agent = await prisma.aIAgents.findUnique({
            where: { slug: agentSlug },
            include: { creator: true }
        });

        if (!agent) {
            return res.status(404).json({ error: "Agent not found" });
        }

        const pricePerHit = agent.pricePerHit;
        const paymentReceipt = agent.creator.walletAddress;

        if (pricePerHit > 0) {
            const paymentTx = req.headers['x-payment-tx'];

            if (paymentTx) {
                const txHash = paymentTx.replace('Bearer ', '');

                // Onchain Verification
                const musdAddress = process.env.MUSD_ADDRESS;
                const rpcUrl = process.env.MANTLE_TESTNET_RPC_URL;
                const provider = new ethers.JsonRpcProvider(rpcUrl);

                try {
                    const tx = await provider.getTransaction(txHash);

                    if (!tx) {
                        return res.status(402).json({ message: "Transaction not found" });
                    }

                    if (!tx.blockNumber) {
                        return res.status(402).json({ message: "Transaction pending" });
                    }

                    // Verify Interaction with MUSD Contract
                    if (tx.to.toLowerCase() !== musdAddress.toLowerCase()) {
                        return res.status(402).json({
                            message: "Transaction is not to MUSD contract",
                            expected: musdAddress,
                            received: tx.to
                        });
                    }

                    // Decode ERC20 Transfer
                    const erc20Interface = new ethers.Interface([
                        "function transfer(address to, uint256 amount)"
                    ]);

                    let decodedData;
                    try {
                        decodedData = erc20Interface.decodeFunctionData("transfer", tx.data);
                    } catch (err) {
                        return res.status(402).json({ message: "Invalid transaction data (not transfer)" });
                    }

                    const recipient = decodedData[0];
                    const amount = decodedData[1];

                    // Verify Recipient
                    if (recipient.toLowerCase() !== paymentReceipt.toLowerCase()) {
                        return res.status(402).json({
                            message: "Invalid payment recipient",
                            expected: paymentReceipt,
                            received: recipient
                        });
                    }

                    // Verify Amount
                    const expectedAmount = ethers.parseUnits(pricePerHit.toString(), 6);

                    if (amount < expectedAmount) {
                        return res.status(402).json({
                            message: "Insufficient payment amount",
                            expected: pricePerHit.toString(),
                            received: ethers.formatUnits(amount, 6)
                        });
                    }

                } catch (error) {
                    console.error("Verification error:", error);
                    return res.status(402).json({ message: "Payment verification failed" });
                }

                // --- Payment Verified: Execute AI Chat ---
                try {
                     // Fetch Agent Resources
                     const maps = await prisma.agentResourceMap.findMany({
                        where: { agentId: agent.id },
                        include: {
                            resource: true
                        }
                    });

                    const resources = maps.map(m => m.resource);

                    // Construct Prompt
                    let finalPrompt = "";

                    // 1. Add System Prompt
                    if (agent.systemPrompt) {
                        finalPrompt += `System Prompt: ${agent.systemPrompt}\n\n`;
                    }

                    // 2. Add Resources Context
                    if (resources.length > 0) {
                        const context = resources.map(r => `Title: ${r.title}\nContent: ${r.content}`).join("\n\n");
                        finalPrompt += `Context information is below.\n---------------------\n${context}\n---------------------\nGiven the context information and not prior knowledge, answer the query.\n`;
                    }

                    // 3. Add User Message
                    finalPrompt += `Query: ${message}`;

                    const response = await chat(finalPrompt);

                    return res.status(200).json({ response });

                } catch (error) {
                    console.error("AI Generation error:", error);
                    return res.status(500).json({ error: "AI Processing Failed" });
                }

            } else {
                // --- 402 Payment Required ---
                
                // Create transaction record for reference/pending status
                 let dbTx;
                 const txId = keccak256(
                     toUtf8Bytes(
                         `${paymentReceipt}-${agentSlug}-${pricePerHit}-${Date.now()}`
                     )
                 );
 
                 try {
                     dbTx = await prisma.transactions.create({
                         data: {
                             id: txId,
                             creatorWallet: paymentReceipt,
                             gatewaySlug: agentSlug,
                             amount: pricePerHit,
                             status: "PENDING"
                         }
                     });
                 } catch (dbError) {
                     console.error("Error saving transaction to DB:", dbError);
                     return res.status(500).json({
                         message: "Internal Server Error",
                     });
                 }

                return res.status(402).json({
                    message: "Payment Required",
                    receiverAddress: paymentReceipt,
                    transactionId: dbTx.id,
                    amount: pricePerHit,
                    currency: "MUSD",
                    chain: "MANTLE TESTNET",
                    requiredHeader: "x-payment-tx"
                });
            }

        } else {
            // Free Agent Logic
            const maps = await prisma.agentResourceMap.findMany({
                where: { agentId: agent.id },
                include: {
                    resource: true
                }
            });

            const resources = maps.map(m => m.resource);

            let finalPrompt = "";

            if (agent.systemPrompt) {
                finalPrompt += `System Prompt: ${agent.systemPrompt}\n\n`;
            }

            if (resources.length > 0) {
                const context = resources.map(r => `Title: ${r.title}\nContent: ${r.content}`).join("\n\n");
                finalPrompt += `Context information is below.\n---------------------\n${context}\n---------------------\nGiven the context information and not prior knowledge, answer the query.\n`;
            }

            finalPrompt += `Query: ${message}`;

            const response = await chat(finalPrompt);
            return res.status(200).json({ response });
        }

    } catch (error) {
        console.error("Error in callAIChat:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}


// Login & Verify
export const nonce = async (req, res) => {
    const { walletAddress } = req.body;
    if (!walletAddress) {
        return res.status(400).json({ message: "Wallet address is required" });
    }

    try {
        const nonce = Math.floor(Math.random() * 1000000).toString();

        // Upsert? Or just update? User said "update nonce on table creator".
        // Assuming creator exists.
        const creator = await prisma.creator.findUnique({
            where: { walletAddress }
        });

        if (!creator) {
            return res.status(404).json({ message: "Creator not found" });
        }

        await prisma.creator.update({
            where: { walletAddress },
            data: { nonce }
        });

        return res.status(200).json({ nonce });
    } catch (error) {
        console.error("Error generating nonce:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};

export const loginVerify = async (req, res) => {
    const { walletAddress, signature } = req.body;

    if (!walletAddress || !signature) {
        return res.status(400).json({ message: "Wallet address and signature are required" });
    }

    try {
        const creator = await prisma.creator.findUnique({
            where: { walletAddress }
        });

        if (!creator || !creator.nonce) {
            return res.status(404).json({ message: "Nonce not found. Please request nonce first." });
        }

        const dbNonce = creator.nonce;

        // VERIFIKASI SIGNATURE
        // recoveredAddress akan menghasilkan alamat wallet yang menandatangani dbNonce
        const recoveredAddress = ethers.verifyMessage(dbNonce, signature);

        if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
            return res.status(401).json({ message: "Invalid signature: Address mismatch" });
        }

        // BERHASIL - Update nonce agar tidak bisa dipakai lagi (Replay Attack Prevention)
        await prisma.creator.update({
            where: { walletAddress },
            data: { nonce: Math.floor(Math.random() * 1000000).toString() }
        });

        return res.status(200).json({
            message: "Login successful",
            walletAddress: walletAddress,
            creatorId: creator.id
        });

    } catch (error) {
        console.error("Error verifying login:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};

export const listWrapped = async (req, res) => {
    try {
        const wrapped = await prisma.wrappedData.findMany({
            select: {
                urlWrapped: true,
                creatorId: true,
                icon: true,
            }
        });
        return res.status(200).json(wrapped);
    } catch (error) {
        console.error("Error listing wrapped:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};

export const listAiAgent = async (req, res) => {
    try {
        const wrapped = await prisma.aIAgents.findMany({
            orderBy: {
                createdAt: "desc"
            }
        });
        return res.status(200).json(wrapped);
    } catch (error) {
        console.error("Error listing wrapped:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};


export const pinata = async (req, res) => {
    try {
        // 1. Ganti ke req.file
        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }

        const formData = new FormData();
        // 2. Gunakan req.file.buffer karena multer menyimpannya di memori
        formData.append('file', req.file.buffer, {
            filename: req.file.originalname,
            contentType: req.file.mimetype
        });

        const metadata = JSON.stringify({
            name: req.file.originalname,
        });
        formData.append('pinataMetadata', metadata);

        const options = JSON.stringify({
            cidVersion: 0,
        });
        formData.append('pinataOptions', options);

        const response = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', formData, {
            headers: {
                ...formData.getHeaders(),
                'Authorization': `Bearer ${process.env.JWT}`
            }
        });

        const ipfsHash = response.data.IpfsHash;
        const url = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;

        // PERBAIKAN PRISMA: .create tidak pakai 'where'
        // Jika ingin update data yang sudah ada berdasarkan creatorId:
        // const updatedData = await prisma.wrappedData.update({
        //     where: {
        //         creatorId: parseInt(req.body.creatorId)
        //     },
        //     data: {
        //         icon: url,
        //     }
        // });

        return res.status(200).json({ url });

    } catch (error) {
        console.error("Error uploading to Pinata:", error);
        if (error.response) {
            return res.status(error.response.status).json(error.response.data);
        }
        return res.status(500).json({ message: error.message });
    }
};
