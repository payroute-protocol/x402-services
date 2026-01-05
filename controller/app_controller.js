import { prisma } from "../util/prisma_config.js"
import { ethers, keccak256, toUtf8Bytes } from "ethers";
import axios from "axios";


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
            orderBy: { walletAddress: 'desc'},
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

        if(wrapped.length === 0){
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
        const { originalUrl, methods, gatewaySlug, header, body, paymentAmount,paymentReceipt, description} = req.body;
        const {creatorId} = req.params;
        if (
            !originalUrl ||
            !methods ||
            !gatewaySlug||
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
                urlWrapped: newUrl
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

        const {originalUrl, methods, paymentReceipt, paymentAmount} = wrapped;
        const requestMethod = req.method.toUpperCase();
        if (!methods.includes(requestMethod)) {
            return res.status(405).json({
                message: "Method not allowed",
            });
        }

        const paymentTx = req.headers['x-payment-tx'];
        if (paymentTx){
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
        } else{
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

        const {originalUrl, methods, paymentReceipt, paymentAmount} = wrapped;
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
            const wallet = new ethers.Wallet(privateKey, provider);
            
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