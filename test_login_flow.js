
// This script simulates the full login flow for testing purposes.
// It creates a new random wallet, registers it, gets a nonce, signs it, and attempts to login.

import { ethers } from "ethers";
import axios from "axios";

async function testLogin() {
    console.log("Starting Login Flow Test...");

    // 1. Create a Random Wallet (Simulates a user with MetaMask)
    const wallet = ethers.Wallet.createRandom();
    console.log(`Created Test Wallet: ${wallet.address}`);
    console.log(`Private Key (DO NOT SHARE): ${wallet.privateKey}`);

    const API_URL = "http://localhost:3000"; // Adjust if your server port is different

    // 2. Register the Creator (if not exists)
    // This is optional if the wallet is already registered, but good for a fresh test.
    try {
        console.log("Attempting Registration...");
        await axios.post(`${API_URL}/creator/register`, { walletAddress: wallet.address });
        console.log("Registration Successful.");
    } catch (e) {
        if (e.response && e.response.status === 409) {
            console.log("Creator already registered (Expected if re-using wallet).");
        } else {
            console.log("Registration Warning/Error:", e.message);
        }
    }

    // 3. Get Nonce
    // Endpoint: POST /nonce/login
    let nonce;
    try {
        console.log("Requesting Nonce...");
        const res = await axios.post(`${API_URL}/nonce/login`, { walletAddress: wallet.address });
        nonce = res.data.nonce;
        console.log(`Received Nonce: "${nonce}"`);
    } catch (e) {
        console.error("Failed to get nonce. Is the server running?");
        console.error("Error:", e.response ? e.response.data : e.message);
        return;
    }

    // 4. Sign the Nonce
    // The critical step: The wallet signs the message (nonce).
    // The output is a hex string (signature).
    const signature = await wallet.signMessage(nonce);
    console.log(`Generated Signature: ${signature}`);

    // 5. Verify Login
    // Endpoint: POST /login/verify
    try {
        console.log("Verifying Login...");
        const loginRes = await axios.post(`${API_URL}/login/verify`, {
            walletAddress: wallet.address,
            signature: signature
        });

        console.log("---------------------------------------------------");
        console.log("LOGIN SUCCESS!");
        console.log("Response:", loginRes.data);
        console.log("---------------------------------------------------");
    } catch (e) {
        console.error("Login Failed!");
        console.error("Status:", e.response ? e.response.status : "Unknown");
        console.error("Data:", e.response ? e.response.data : e.message);
    }
}

testLogin();
