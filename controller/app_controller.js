import { prisma } from "../util/prisma_config.js"
import { ethers } from "ethers";

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