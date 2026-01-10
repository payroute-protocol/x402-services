import express from 'express';
import { listWrapped,registerCreator, loginVerify, nonce, getProfile, getCreatorAll, getCreatorWrapped, createWrapped, getPayroute, getPayrouteWithEscrow, createAgent, getCreatorAgents, getAgentDetails, createAgentResource, getCreatorResources, attachResourceToAgent, getAgentResources, detachResourceFromAgent, callAIChat } from '../controller/app_controller.js';

const router = express.Router();

// ... existing routes ...

// ... existing routes ...

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
 *                 type: float
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
 * /escrow/{gatewaySlug}:
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
 *     tags: [PayrouteWithEscrow]
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
router.all("/escrow/:gatewaySlug", getPayrouteWithEscrow)


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


// Agent Management

/**
 * @swagger
 * /creator/{creatorId}/agents:
 *   post:
 *     summary: Create a new AI Agent for a creator
 *     tags: [Agent]
 *     parameters:
 *       - in: path
 *         name: creatorId
 *         schema:
 *           type: integer
 *         required: true
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - slug
 *               - modelProvider
 *               - modelName
 *               - systemPrompt
 *             properties:
 *               name:
 *                 type: string
 *               slug:
 *                 type: string
 *               description:
 *                 type: string
 *               modelProvider:
 *                 type: string
 *                 enum: [openai, anthropic, local]
 *               modelName:
 *                 type: string
 *               systemPrompt:
 *                 type: string
 *               pricePerHit:
 *                 type: number
 *               isActive:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Agent created
 *       400:
 *         description: Missing fields
 *       409:
 *         description: Slug exists
 *       500:
 *         description: Server error
 *   get:
 *     summary: List all agents for a creator
 *     tags: [Agent]
 *     parameters:
 *       - in: path
 *         name: creatorId
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       200:
 *         description: List of agents
 *       500:
 *         description: Server error
 */
router.post('/creator/:creatorId/agents', createAgent);
router.get('/creator/:creatorId/agents', getCreatorAgents);

/**
 * @swagger
 * /agent/{agentId}:
 *   get:
 *     summary: Get agent details
 *     tags: [Agent]
 *     parameters:
 *       - in: path
 *         name: agentId
 *         schema:
 *           type: string
 *           format: uuid
 *         required: true
 *     responses:
 *       200:
 *         description: Agent details
 *       404:
 *         description: Agent not found
 *       500:
 *         description: Server error
 */
router.get('/agent/:agentId', getAgentDetails);

/**
 * @swagger
 * /agent/{agentId}/chat:
 *   post:
 *     summary: Chat with an AI Agent
 *     tags: [Agent]
 *     parameters:
 *       - in: path
 *         name: agentId
 *         schema:
 *           type: string
 *           format: uuid
 *         required: true
 *       - in: header
 *         name: x-payment-tx
 *         schema:
 *           type: string
 *         description: Direct Payment Transaction Hash (Bearer <txHash>)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *     responses:
 *       200:
 *         description: Chat response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 response:
 *                   type: string
 *       400:
 *         description: Missing message
 *       500:
 *         description: Server error
 */
router.post('/agent/:agentId/chat', callAIChat);

// Agent Resources

/**
 * @swagger
 * /creator/{creatorId}/resources:
 *   post:
 *     summary: Create a new resource for a creator
 *     tags: [AgentResource]
 *     parameters:
 *       - in: path
 *         name: creatorId
 *         schema:
 *           type: integer
 *         required: true
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - title
 *               - content
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [TEXT, LINK, SMART_CONTRACT]
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *               metadata:
 *                 type: object
 *     responses:
 *       201:
 *         description: Resource created
 *       400:
 *         description: Missing fields
 *       500:
 *         description: Server error
 *   get:
 *     summary: List all resources for a creator
 *     tags: [AgentResource]
 *     parameters:
 *       - in: path
 *         name: creatorId
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       200:
 *         description: List of resources
 *       500:
 *         description: Server error
 */
router.post('/creator/:creatorId/resources', createAgentResource);
router.get('/creator/:creatorId/resources', getCreatorResources);

/**
 * @swagger
 * /agent/{agentId}/resources:
 *   post:
 *     summary: Attach a resource to an agent
 *     tags: [AgentResource]
 *     parameters:
 *       - in: path
 *         name: agentId
 *         schema:
 *           type: string
 *           format: uuid
 *         required: true
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - resourceId
 *             properties:
 *               resourceId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       201:
 *         description: Resource attached
 *       409:
 *         description: Already attached
 *       500:
 *         description: Server error
 *   get:
 *     summary: Get resources attached to an agent
 *     tags: [AgentResource]
 *     parameters:
 *       - in: path
 *         name: agentId
 *         schema:
 *           type: string
 *           format: uuid
 *         required: true
 *     responses:
 *       200:
 *         description: List of attached resources
 *       500:
 *         description: Server error
 */
router.post('/agent/:agentId/resources', attachResourceToAgent);
router.get('/agent/:agentId/resources', getAgentResources);

/**
 * @swagger
 * /agent/{agentId}/resources/{resourceId}:
 *   delete:
 *     summary: Detach a resource from an agent
 *     tags: [AgentResource]
 *     parameters:
 *       - in: path
 *         name: agentId
 *         schema:
 *           type: string
 *           format: uuid
 *         required: true
 *       - in: path
 *         name: resourceId
 *         schema:
 *           type: string
 *           format: uuid
 *         required: true
 *     responses:
 *       200:
 *         description: Resource detached
 *       404:
 *         description: Linkage not found
 *       500:
 *         description: Server error
 */
router.delete('/agent/:agentId/resources/:resourceId', detachResourceFromAgent);

/**
 * @swagger
 * /login/verify:
 *   post:
 *     summary: Verify login signature
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - walletAddress
 *               - signature
 *             properties:
 *               walletAddress:
 *                 type: string
 *                 description: The user's wallet address
 *               signature:
 *                 type: string
 *                 description: The cryptographic signature of the nonce
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 walletAddress:
 *                   type: string
 *       400:
 *         description: Missing fields or invalid signature format
 *       401:
 *         description: Invalid signature
 *       402:
 *         description: Nonce reuse detected
 *       404:
 *         description: Creator not found
 *       500:
 *         description: Server error
 */
router.post('/login/verify', loginVerify);

/**
 * @swagger
 * /nonce/login:
 *   post:
 *     summary: Generate a nonce for login
 *     tags: [Auth]
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
 *         description: Nonce generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 nonce:
 *                   type: string
 *                   description: Random nonce string to be signed
 *       400:
 *         description: Wallet address missing
 *       404:
 *         description: Creator not found
 *       500:
 *         description: Server error
 */
router.post('/nonce/login', nonce);

/**
 * @swagger
 * /list/urlWrapped:
 *   get:
 *     summary: List all wrapped URLs
 *     tags: [Creator]
 *     responses:
 *       200:
 *         description: List of wrapped URLs and creator IDs.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   urlWrapped:
 *                     type: string
 *                   creatorId:
 *                     type: integer
 *       500:
 *         description: Server error
 */
router.get('/list/urlWrapped', listWrapped)

export default router;