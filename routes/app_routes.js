import express from 'express';
import { registerCreator, getProfile, getCreatorAll, getCreatorWrapped } from '../controller/app_controller.js';

const router = express.Router();

//creator needed

/**
 * @swagger
 * components:
 *   schemas:
 *     Creator:
 *       type: object
 *       required:
 *         - walletAddress
 *       properties:
 *         id:
 *           type: integer
 *           description: The auto-generated id of the creator
 *         walletAddress:
 *           type: string
 *           description: The wallet address of the creator
 *     WrappedData:
 *       type: object
 *       properties:
 *         id:
 *            type: integer
 *         creatorId:
 *            type: integer
 */

/**
 * @swagger
 * tags:
 *   name: Creator
 *   description: The creator managing API
 */

/**
 * @swagger
 * /creator/register:
 *   post:
 *     summary: Register a new creator
 *     tags: [Creator]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - walletAddress
 *             properties:
 *               walletAddress:
 *                 type: string
 *     responses:
 *       200:
 *         description: The created creator.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Creator'
 *       400:
 *         description: Wallet address missing
 *       409:
 *         description: Creator already exists
 *       500:
 *         description: Server error
 */
router.post('/creator/register', registerCreator);

/**
 * @swagger
 * /creator/{id}:
 *   get:
 *     summary: Get creator profile by ID
 *     tags: [Creator]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: The creator ID
 *     responses:
 *       200:
 *         description: The creator profile
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Creator'
 *       500:
 *         description: Server error
 */
router.get('/creator/:id', getProfile)

/**
 * @swagger
 * /creator/:
 *   get:
 *     summary: Get all creators
 *     tags: [Creator]
 *     responses:
 *       200:
 *         description: List of all creators
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Creator'
 *       500:
 *         description: Server error
 */
router.get('/creator/', getCreatorAll)

/**
 * @swagger
 * /creator/wrapped/{idCreator}:
 *   get:
 *     summary: Get wrapped data for a creator
 *     tags: [Creator]
 *     parameters:
 *       - in: path
 *         name: idCreator
 *         schema:
 *           type: integer
 *         required: true
 *         description: The creator ID
 *     responses:
 *       200:
 *         description: Wrapped data list
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/WrappedData'
 *       404:
 *         description: No wrapped data found
 *       500:
 *         description: Server error
 */
router.get('/creator/wrapped/:idCreator', getCreatorWrapped)
// router.get('/creator/profile/:id', getCreatorProfile);

// // payment x402
// router.get('/creator/assets/:id/purchase', getAssetsWithPayment);
// router.post('/creator/assets/:id/verify', verifyAssetsPayment);

// router.get('/creator/find-by-wallet/:walletAddress', getProfileByWalletAddress);


export default router;