import express from 'express';
import { registerCreator, getProfile, getCreatorAll, getCreatorWrapped, createWrapped, getPayroute, getPayrouteWithEscrow } from '../controller/app_controller.js';

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

/**
 * @swagger
 * /creator/wrapped/{creatorId}:
 *   post:
 *     summary: Create new wrapped data
 *     tags: [Creator]
 *     parameters:
 *       - in: path
 *         name: creatorId
 *         schema:
 *           type: integer
 *         required: true
 *         description: The creator ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - originalUrl
 *               - methods
 *               - gatewaySlug
 *               - paymentAmount
 *               - paymentReceipt
 *               - description
 *             properties:
 *               originalUrl:
 *                 type: string
 *               methods:
 *                 type: string
 *               gatewaySlug:
 *                 type: string
 *               paymentAmount:
 *                 type: string
 *               paymentReceipt:
 *                 type: string
 *               description:
 *                  type: string
 *     responses:
 *       201:
 *         description: The created wrapped data.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: success
 *                 newUrl:
 *                   type: string
 *       400:
 *         description: Missing required fields
 *       500:
 *         description: Server error
 */
router.post('/creator/wrapped/:creatorId', createWrapped)

// payment x402
/**
 * @swagger
 * /{gatewaySlug}:
 *   get:
 *     summary: Access a gateway endpoint (GET)
 *     tags: [PayrouteWithEscrow]
 *     parameters:
 *       - in: path
 *         name: gatewaySlug
 *         schema:
 *           type: string
 *         required: true
 *         description: The gateway slug
 *       - in: header
 *         name: x-payment-tx
 *         schema:
 *           type: string
 *         description: Escrow Transaction ID
 *     responses:
 *       200:
 *         description: Proxy Success
 *       402:
 *         description: Payment Required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 receiverAddress:
 *                   type: string
 *                 transactionId:
 *                   type: string
 *                 escrowAddress:
 *                   type: string
 *                 amount:
 *                   type: number
 *                 currency:
 *                   type: string
 *                 chain:
 *                   type: string
 *                 requiredHeader:
 *                   type: string
 *       404:
 *         description: Gateway not found
 *       500:
 *         description: Server Error
 *   post:
 *     summary: Access a gateway endpoint (POST)
 *     tags: [Payroute]
 *     parameters:
 *       - in: path
 *         name: gatewaySlug
 *         schema:
 *           type: string
 *         required: true
 *       - in: header
 *         name: x-payment-tx
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Proxy Success
 *       402:
 *         description: Payment Required
 *       404:
 *         description: Gateway not found
 *       500:
 *         description: Server Error
 */
// router.all("/:gatewaySlug", getPayrouteWithEscrow)


/**
 * @swagger
 * /{gatewaySlug}:
 *   get:
 *     summary: Access a gateway endpoint (Direct Payment)
 *     tags: [Payroute]
 *     parameters:
 *       - in: path
 *         name: gatewaySlug
 *         schema:
 *           type: string
 *         required: true
 *         description: The gateway slug
 *       - in: header
 *         name: x-payment-tx
 *         schema:
 *           type: string
 *         description: Direct Payment Transaction Hash (Bearer <txHash>)
 *     responses:
 *       200:
 *         description: Proxy Success
 *       402:
 *         description: Payment Required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 receiverAddress:
 *                   type: string
 *                 transactionId:
 *                   type: string
 *                 amount:
 *                   type: number
 *                 currency:
 *                   type: string
 *                 chain:
 *                   type: string
 *                 requiredHeader:
 *                   type: string
 *       404:
 *         description: Gateway not found
 *       500:
 *         description: Server Error
 *   post:
 *     summary: Access a gateway endpoint (Direct Payment POST)
 *     tags: [Payroute]
 *     parameters:
 *       - in: path
 *         name: gatewaySlug
 *         schema:
 *           type: string
 *         required: true
 *       - in: header
 *         name: x-payment-tx
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Proxy Success
 *       402:
 *         description: Payment Required
 *       404:
 *         description: Gateway not found
 *       500:
 *         description: Server Error
 */
router.all("/:gatewaySlug", getPayroute);






// router.post('/creator/assets/:id/verify', verifyAssetsPayment);

// router.get('/creator/find-by-wallet/:walletAddress', getProfileByWalletAddress);


export default router;