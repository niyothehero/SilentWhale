// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@fhenixprotocol/cofhe-contracts/FHE.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract SilentWhale is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint8 public constant TIER_FREE = 0;
    uint8 public constant TIER_PRO = 1;
    uint8 public constant TIER_ELITE = 2;
    uint8 public constant TIER_DAO = 3;
    uint64 public constant MONTH = 30 days;

    error ActiveDowngrade();
    error AnalystNotApproved();
    error BadAlert();
    error BadDuration();
    error BadFeed();
    error BadIndex();
    error BadReceipt();
    error BadSeats();
    error BadSignal();
    error BadTeam();
    error BadTier();
    error BelowFeedTier();
    error DaoRequired();
    error ExpiryInPast();
    error FeedInactive();
    error ItemInactive();
    error NoScore();
    error NotSignalAdmin();
    error NotTeamOwner();
    error OwnerSeatRequired();
    error PublishCooldown();
    error RefundFailed();
    error SeatsFull();
    error TeamInactive();
    error TierTooLow();
    error TierUnavailable();
    error TokenDisabled();
    error TokenTierUnavailable();
    error TokenUnset();
    error Underpaid();
    error WithdrawFailed();
    error ZeroAddress();
    error ZeroToken();

    struct Feed {
        string name;
        string description;
        uint8 minTier;
        uint256 monthlyPriceWei;
        bool active;
        address curator;
    }

    struct Subscription {
        uint8 tier;
        uint64 expiresAt;
    }

    struct Signal {
        address analyst;
        uint256 feedId;
        string headline;
        string publicSummary;
        string tokenSymbol;
        string sector;
        string movementType;
        string venue;
        string sourceChain;
        string eventRef;
        string aiModel;
        string scoreProvenance;
        uint8 minTier;
        uint64 createdAt;
        uint64 updatedAt;
        bool active;
        eaddress encryptedWhale;
        euint64 encryptedAmountUsd;
        euint32 encryptedConfidenceBps;
        euint32 encryptedEntryPriceBps;
        euint32 encryptedRiskBps;
    }

    struct WatchlistItem {
        bytes32 labelHash;
        string publicNote;
        uint64 createdAt;
        bool active;
        eaddress encryptedWallet;
        euint32 encryptedMinConfidenceBps;
    }

    struct PaymentReceipt {
        address payer;
        address token;
        uint8 tier;
        uint8 monthCount;
        uint256 amount;
        uint64 paidAt;
        uint64 expiresAt;
    }

    struct Team {
        address owner;
        bytes32 nameHash;
        uint8 tier;
        uint16 seatLimit;
        uint16 memberCount;
        uint64 createdAt;
        bool active;
    }

    struct AlertReceipt {
        bytes32 ruleHash;
        uint256 signalId;
        string channel;
        string deliveryRef;
        uint64 createdAt;
        bool read;
    }

    struct AnalystProfile {
        string displayName;
        string bio;
        string strategy;
        string uri;
        uint64 updatedAt;
        bool active;
    }

    Feed[] private _feeds;
    Signal[] private _signals;
    Team[] private _teams;

    mapping(address => Subscription) private _subscriptions;
    mapping(uint8 => uint256) public tierPriceWei;
    mapping(uint8 => uint256) public tierTokenPrice;
    mapping(address => uint256[]) private _analystSignals;
    mapping(address => WatchlistItem[]) private _watchlists;
    mapping(address => PaymentReceipt[]) private _receipts;
    mapping(address => AlertReceipt[]) private _alerts;
    mapping(address => uint256[]) private _memberTeams;
    mapping(uint256 => mapping(address => bool)) public teamMembers;
    mapping(address => euint32) private _analystScores;
    mapping(address => AnalystProfile) private _analystProfiles;
    mapping(address => bool) public hasAnalystScore;
    mapping(address => bool) public hasAnalystProfile;
    mapping(address => bool) public approvedAnalysts;
    mapping(address => uint64) public lastPublishedAt;

    address public paymentToken;
    uint8 public paymentTokenDecimals;
    bool public paymentTokenEnabled;
    uint64 public publishCooldownSeconds;

    event FeedCreated(
        uint256 indexed feedId,
        string name,
        uint8 minTier,
        uint256 monthlyPriceWei
    );
    event FeedUpdated(uint256 indexed feedId, bool active, uint8 minTier);
    event SignalPublished(
        uint256 indexed signalId,
        address indexed analyst,
        uint256 indexed feedId,
        uint8 minTier,
        string tokenSymbol,
        string sector
    );
    event SignalMetadataUpdated(
        uint256 indexed signalId,
        address indexed editor,
        uint8 minTier,
        bool active
    );
    event SignalAccessGranted(
        uint256 indexed signalId,
        address indexed account
    );
    event Subscribed(
        address indexed account,
        uint8 tier,
        uint64 expiresAt,
        uint256 paid
    );
    event PaymentTokenUpdated(
        address indexed token,
        uint8 decimals,
        bool enabled
    );
    event TierTokenPriceUpdated(
        uint8 indexed tier,
        uint256 monthlyPrice
    );
    event PaymentReceiptRecorded(
        address indexed account,
        uint256 indexed receiptId,
        address indexed token,
        uint8 tier,
        uint8 monthCount,
        uint256 amount
    );
    event TeamCreated(
        uint256 indexed teamId,
        address indexed owner,
        bytes32 nameHash,
        uint16 seatLimit
    );
    event TeamMemberUpdated(
        uint256 indexed teamId,
        address indexed member,
        bool active
    );
    event TeamUpdated(uint256 indexed teamId, bool active, uint16 seatLimit);
    event AlertRecorded(
        address indexed account,
        uint256 indexed alertId,
        uint256 indexed signalId,
        bytes32 ruleHash
    );
    event AlertReadUpdated(
        address indexed account,
        uint256 indexed alertId,
        bool read
    );
    event WatchlistItemAdded(address indexed account, uint256 indexed index);
    event WatchlistAccessGranted(address indexed account, uint256 indexed index);
    event AnalystScoreUpdated(address indexed analyst);
    event AnalystProfileUpdated(address indexed analyst, string displayName);
    event AnalystStatusUpdated(address indexed analyst, bool approved);
    event TierPriceUpdated(uint8 indexed tier, uint256 monthlyPriceWei);
    event PublishCooldownUpdated(uint64 secondsBetweenPublishes);
    event TreasuryWithdrawal(address indexed recipient, uint256 amount);
    event TokenWithdrawal(
        address indexed token,
        address indexed recipient,
        uint256 amount
    );

    constructor(address initialOwner) Ownable(initialOwner) {
        approvedAnalysts[initialOwner] = true;
        tierPriceWei[TIER_PRO] = 0.001 ether;
        tierPriceWei[TIER_ELITE] = 0.003 ether;
        tierPriceWei[TIER_DAO] = 0.01 ether;
        tierTokenPrice[TIER_PRO] = 19 * 10 ** 6;
        tierTokenPrice[TIER_ELITE] = 49 * 10 ** 6;
        tierTokenPrice[TIER_DAO] = 149 * 10 ** 6;

        _createFeed(
            "Whale Rotation",
            "Encrypted high-conviction whale accumulation and distribution signals.",
            TIER_PRO,
            tierPriceWei[TIER_PRO],
            initialOwner
        );
        _createFeed(
            "Smart Money Wallets",
            "Private wallet-level intelligence for repeatable on-chain edges.",
            TIER_ELITE,
            tierPriceWei[TIER_ELITE],
            initialOwner
        );
        _createFeed(
            "DAO Intelligence",
            "Institutional signal flow with team-grade disclosure controls.",
            TIER_DAO,
            tierPriceWei[TIER_DAO],
            initialOwner
        );
    }

    function feedCount() external view returns (uint256) {
        return _feeds.length;
    }

    function signalCount() external view returns (uint256) {
        return _signals.length;
    }

    function teamCount() external view returns (uint256) {
        return _teams.length;
    }

    function analystSignalCount(address analyst) external view returns (uint256) {
        return _analystSignals[analyst].length;
    }

    function watchlistCount(address account) external view returns (uint256) {
        return _watchlists[account].length;
    }

    function receiptCount(address account) external view returns (uint256) {
        return _receipts[account].length;
    }

    function alertCount(address account) external view returns (uint256) {
        return _alerts[account].length;
    }

    function memberTeamCount(address account) external view returns (uint256) {
        return _memberTeams[account].length;
    }

    function getFeed(uint256 feedId)
        external
        view
        returns (
            string memory name,
            string memory description,
            uint8 minTier,
            uint256 monthlyPriceWei,
            bool active,
            address curator
        )
    {
        Feed storage feed = _feed(feedId);
        return (
            feed.name,
            feed.description,
            feed.minTier,
            feed.monthlyPriceWei,
            feed.active,
            feed.curator
        );
    }

    function createFeed(
        string calldata name,
        string calldata description,
        uint8 minTier,
        uint256 monthlyPriceWei,
        address curator
    ) external onlyOwner returns (uint256 feedId) {
        return _createFeed(name, description, minTier, monthlyPriceWei, curator);
    }

    function updateFeed(
        uint256 feedId,
        string calldata name,
        string calldata description,
        uint8 minTier,
        uint256 monthlyPriceWei,
        bool active,
        address curator
    ) external onlyOwner {
        _requireTier(minTier);
        Feed storage feed = _feed(feedId);
        if (curator == address(0)) revert ZeroAddress();
        feed.name = name;
        feed.description = description;
        feed.minTier = minTier;
        feed.monthlyPriceWei = monthlyPriceWei;
        feed.active = active;
        feed.curator = curator;

        emit FeedUpdated(feedId, active, minTier);
    }

    function publishSignal(
        uint256 feedId,
        string calldata headline,
        string calldata publicSummary,
        string calldata tokenSymbol,
        string calldata sector,
        string calldata movementType,
        string calldata venue,
        string calldata sourceChain,
        string calldata eventRef,
        string calldata aiModel,
        string calldata scoreProvenance,
        uint8 minTier,
        InEaddress calldata encryptedWhale,
        InEuint64 calldata encryptedAmountUsd,
        InEuint32 calldata encryptedConfidenceBps,
        InEuint32 calldata encryptedEntryPriceBps,
        InEuint32 calldata encryptedRiskBps
    ) external returns (uint256 signalId) {
        _requirePublishAllowed(feedId, minTier);

        eaddress whale = FHE.asEaddress(encryptedWhale);
        euint64 amountUsd = FHE.asEuint64(encryptedAmountUsd);
        euint32 confidenceBps = FHE.asEuint32(encryptedConfidenceBps);
        euint32 entryPriceBps = FHE.asEuint32(encryptedEntryPriceBps);
        euint32 riskBps = FHE.asEuint32(encryptedRiskBps);

        _allowSignalHandles(
            whale,
            amountUsd,
            confidenceBps,
            entryPriceBps,
            riskBps,
            msg.sender
        );
        if (owner() != msg.sender) {
            _allowSignalHandles(
                whale,
                amountUsd,
                confidenceBps,
                entryPriceBps,
                riskBps,
                owner()
            );
        }

        _signals.push(
            Signal({
                analyst: msg.sender,
                feedId: feedId,
                headline: headline,
                publicSummary: publicSummary,
                tokenSymbol: tokenSymbol,
                sector: sector,
                movementType: movementType,
                venue: venue,
                sourceChain: sourceChain,
                eventRef: eventRef,
                aiModel: aiModel,
                scoreProvenance: scoreProvenance,
                minTier: minTier,
                createdAt: uint64(block.timestamp),
                updatedAt: uint64(block.timestamp),
                active: true,
                encryptedWhale: whale,
                encryptedAmountUsd: amountUsd,
                encryptedConfidenceBps: confidenceBps,
                encryptedEntryPriceBps: entryPriceBps,
                encryptedRiskBps: riskBps
            })
        );

        signalId = _signals.length - 1;
        _analystSignals[msg.sender].push(signalId);
        lastPublishedAt[msg.sender] = uint64(block.timestamp);

        emit SignalPublished(
            signalId,
            msg.sender,
            feedId,
            minTier,
            tokenSymbol,
            sector
        );
    }

    function getSignal(uint256 signalId)
        external
        view
        returns (
            address analyst,
            uint256 feedId,
            string memory headline,
            string memory publicSummary,
            string memory tokenSymbol,
            string memory sector,
            string memory movementType,
            string memory venue,
            string memory sourceChain,
            string memory eventRef,
            string memory aiModel,
            string memory scoreProvenance,
            uint8 minTier,
            uint64 createdAt,
            uint64 updatedAt,
            bool active,
            eaddress encryptedWhale,
            euint64 encryptedAmountUsd,
            euint32 encryptedConfidenceBps,
            euint32 encryptedEntryPriceBps,
            euint32 encryptedRiskBps
        )
    {
        Signal storage signal = _signal(signalId);
        return (
            signal.analyst,
            signal.feedId,
            signal.headline,
            signal.publicSummary,
            signal.tokenSymbol,
            signal.sector,
            signal.movementType,
            signal.venue,
            signal.sourceChain,
            signal.eventRef,
            signal.aiModel,
            signal.scoreProvenance,
            signal.minTier,
            signal.createdAt,
            signal.updatedAt,
            signal.active,
            signal.encryptedWhale,
            signal.encryptedAmountUsd,
            signal.encryptedConfidenceBps,
            signal.encryptedEntryPriceBps,
            signal.encryptedRiskBps
        );
    }

    function analystSignalAt(address analyst, uint256 index)
        external
        view
        returns (uint256)
    {
        if (index >= _analystSignals[analyst].length) revert BadIndex();
        return _analystSignals[analyst][index];
    }

    function updateSignalMetadata(
        uint256 signalId,
        string calldata headline,
        string calldata publicSummary,
        string calldata tokenSymbol,
        string calldata sector,
        string calldata movementType,
        string calldata venue,
        string calldata sourceChain,
        string calldata eventRef,
        string calldata aiModel,
        string calldata scoreProvenance,
        uint8 minTier,
        bool active
    ) external {
        _requireTier(minTier);
        Signal storage signal = _signal(signalId);
        if (msg.sender != owner() && msg.sender != signal.analyst) {
            revert NotSignalAdmin();
        }
        Feed storage feed = _feed(signal.feedId);
        if (minTier < feed.minTier) revert BelowFeedTier();

        signal.headline = headline;
        signal.publicSummary = publicSummary;
        signal.tokenSymbol = tokenSymbol;
        signal.sector = sector;
        signal.movementType = movementType;
        signal.venue = venue;
        signal.sourceChain = sourceChain;
        signal.eventRef = eventRef;
        signal.aiModel = aiModel;
        signal.scoreProvenance = scoreProvenance;
        signal.minTier = minTier;
        signal.active = active;
        signal.updatedAt = uint64(block.timestamp);

        emit SignalMetadataUpdated(signalId, msg.sender, minTier, active);
    }

    function setSignalActive(uint256 signalId, bool active) external {
        Signal storage signal = _signal(signalId);
        if (msg.sender != owner() && msg.sender != signal.analyst) {
            revert NotSignalAdmin();
        }
        signal.active = active;
        signal.updatedAt = uint64(block.timestamp);
        emit SignalMetadataUpdated(signalId, msg.sender, signal.minTier, active);
    }

    function grantSignalAccess(uint256 signalId) external {
        if (!canAccessSignal(msg.sender, signalId)) revert TierTooLow();
        Signal storage signal = _signal(signalId);

        FHE.allow(signal.encryptedWhale, msg.sender);
        FHE.allow(signal.encryptedAmountUsd, msg.sender);
        FHE.allow(signal.encryptedConfidenceBps, msg.sender);
        FHE.allow(signal.encryptedEntryPriceBps, msg.sender);
        FHE.allow(signal.encryptedRiskBps, msg.sender);

        emit SignalAccessGranted(signalId, msg.sender);
    }

    function canAccessSignal(address account, uint256 signalId)
        public
        view
        returns (bool)
    {
        Signal storage signal = _signal(signalId);
        if (!signal.active) return false;
        if (account == signal.analyst || account == owner()) return true;
        return effectiveTier(account) >= signal.minTier;
    }

    function subscribe(uint8 tier, uint8 monthCount) external payable nonReentrant {
        _requirePaidTier(tier);
        uint256 price = tierPriceWei[tier] * monthCount;
        if (price == 0) revert TierUnavailable();
        if (msg.value < price) revert Underpaid();

        uint64 expiresAt = _activateSubscription(
            msg.sender,
            tier,
            monthCount,
            price
        );

        uint256 refund = msg.value - price;
        if (refund > 0) {
            (bool sent, ) = msg.sender.call{value: refund}("");
            if (!sent) revert RefundFailed();
        }

        _recordReceipt(msg.sender, address(0), tier, monthCount, price, expiresAt);
    }

    function subscribeWithToken(uint8 tier, uint8 monthCount) external nonReentrant {
        _requirePaidTier(tier);
        if (!paymentTokenEnabled) revert TokenDisabled();
        if (paymentToken == address(0)) revert TokenUnset();
        uint256 price = tierTokenPrice[tier] * monthCount;
        if (price == 0) revert TokenTierUnavailable();

        IERC20(paymentToken).safeTransferFrom(msg.sender, address(this), price);
        uint64 expiresAt = _activateSubscription(
            msg.sender,
            tier,
            monthCount,
            price
        );
        _recordReceipt(msg.sender, paymentToken, tier, monthCount, price, expiresAt);
    }

    function grantSubscription(
        address account,
        uint8 tier,
        uint64 expiresAt
    ) external onlyOwner {
        _requirePaidTier(tier);
        if (account == address(0)) revert ZeroAddress();
        if (expiresAt <= block.timestamp) revert ExpiryInPast();
        _subscriptions[account] = Subscription({tier: tier, expiresAt: expiresAt});
        emit Subscribed(account, tier, expiresAt, 0);
    }

    function subscriptionOf(address account)
        external
        view
        returns (uint8 tier, uint64 expiresAt, bool active)
    {
        Subscription storage subscription = _subscriptions[account];
        active = subscription.expiresAt >= block.timestamp;
        tier = active ? subscription.tier : TIER_FREE;
        expiresAt = subscription.expiresAt;
    }

    function effectiveTier(address account) public view returns (uint8 tier) {
        Subscription storage subscription = _subscriptions[account];
        if (subscription.expiresAt >= block.timestamp) {
            tier = subscription.tier;
        }

        uint256[] storage teamIds = _memberTeams[account];
        for (uint256 i = 0; i < teamIds.length; i++) {
            Team storage team = _teams[teamIds[i]];
            if (!teamMembers[teamIds[i]][account]) continue;
            if (!team.active) continue;
            Subscription storage ownerSub = _subscriptions[team.owner];
            if (ownerSub.expiresAt >= block.timestamp && ownerSub.tier >= team.tier) {
                if (team.tier > tier) tier = team.tier;
            }
        }
    }

    function setTierPrice(uint8 tier, uint256 monthlyPriceWei) external onlyOwner {
        _requirePaidTier(tier);
        tierPriceWei[tier] = monthlyPriceWei;
        emit TierPriceUpdated(tier, monthlyPriceWei);
    }

    function setPaymentToken(
        address token,
        uint8 decimals,
        bool enabled
    ) external onlyOwner {
        if (enabled && token == address(0)) revert ZeroToken();
        paymentToken = token;
        paymentTokenDecimals = decimals;
        paymentTokenEnabled = enabled;
        emit PaymentTokenUpdated(token, decimals, enabled);
    }

    function setTierTokenPrice(uint8 tier, uint256 monthlyPrice) external onlyOwner {
        _requirePaidTier(tier);
        tierTokenPrice[tier] = monthlyPrice;
        emit TierTokenPriceUpdated(tier, monthlyPrice);
    }

    function getPaymentReceipt(address account, uint256 index)
        external
        view
        returns (
            address payer,
            address token,
            uint8 tier,
            uint8 monthCount,
            uint256 amount,
            uint64 paidAt,
            uint64 expiresAt
        )
    {
        if (index >= _receipts[account].length) revert BadReceipt();
        PaymentReceipt storage receipt = _receipts[account][index];
        return (
            receipt.payer,
            receipt.token,
            receipt.tier,
            receipt.monthCount,
            receipt.amount,
            receipt.paidAt,
            receipt.expiresAt
        );
    }

    function setAnalystStatus(address analyst, bool approved) external onlyOwner {
        if (analyst == address(0)) revert ZeroAddress();
        approvedAnalysts[analyst] = approved;
        emit AnalystStatusUpdated(analyst, approved);
    }

    function setAnalystProfile(
        string calldata displayName,
        string calldata bio,
        string calldata strategy,
        string calldata uri
    ) external {
        if (msg.sender != owner() && !approvedAnalysts[msg.sender]) {
            revert AnalystNotApproved();
        }
        _setAnalystProfile(msg.sender, displayName, bio, strategy, uri, true);
    }

    function setAnalystProfileFor(
        address analyst,
        string calldata displayName,
        string calldata bio,
        string calldata strategy,
        string calldata uri,
        bool active
    ) external onlyOwner {
        if (analyst == address(0)) revert ZeroAddress();
        _setAnalystProfile(analyst, displayName, bio, strategy, uri, active);
    }

    function getAnalystProfile(address analyst)
        external
        view
        returns (
            string memory displayName,
            string memory bio,
            string memory strategy,
            string memory uri,
            uint64 updatedAt,
            bool active
        )
    {
        AnalystProfile storage profile = _analystProfiles[analyst];
        return (
            profile.displayName,
            profile.bio,
            profile.strategy,
            profile.uri,
            profile.updatedAt,
            profile.active
        );
    }

    function addWatchlistItem(
        bytes32 labelHash,
        string calldata publicNote,
        InEaddress calldata encryptedWallet,
        InEuint32 calldata encryptedMinConfidenceBps
    ) external returns (uint256 index) {
        eaddress wallet = FHE.asEaddress(encryptedWallet);
        euint32 minConfidenceBps = FHE.asEuint32(encryptedMinConfidenceBps);

        FHE.allowThis(wallet);
        FHE.allowThis(minConfidenceBps);
        FHE.allowSender(wallet);
        FHE.allowSender(minConfidenceBps);

        _watchlists[msg.sender].push(
            WatchlistItem({
                labelHash: labelHash,
                publicNote: publicNote,
                createdAt: uint64(block.timestamp),
                active: true,
                encryptedWallet: wallet,
                encryptedMinConfidenceBps: minConfidenceBps
            })
        );
        index = _watchlists[msg.sender].length - 1;
        emit WatchlistItemAdded(msg.sender, index);
    }

    function getWatchlistItem(address account, uint256 index)
        external
        view
        returns (
            bytes32 labelHash,
            string memory publicNote,
            uint64 createdAt,
            bool active,
            eaddress encryptedWallet,
            euint32 encryptedMinConfidenceBps
        )
    {
        WatchlistItem storage item = _watchlistItem(account, index);
        return (
            item.labelHash,
            item.publicNote,
            item.createdAt,
            item.active,
            item.encryptedWallet,
            item.encryptedMinConfidenceBps
        );
    }

    function setWatchlistItemActive(uint256 index, bool active) external {
        WatchlistItem storage item = _watchlistItem(msg.sender, index);
        item.active = active;
    }

    function grantWatchlistAccess(uint256 index) external {
        WatchlistItem storage item = _watchlistItem(msg.sender, index);
        if (!item.active) revert ItemInactive();
        FHE.allow(item.encryptedWallet, msg.sender);
        FHE.allow(item.encryptedMinConfidenceBps, msg.sender);
        emit WatchlistAccessGranted(msg.sender, index);
    }

    function createTeam(bytes32 nameHash, uint16 seatLimit)
        external
        returns (uint256 teamId)
    {
        if (effectiveTier(msg.sender) < TIER_DAO) revert DaoRequired();
        if (seatLimit == 0 || seatLimit > 200) revert BadSeats();

        _teams.push(
            Team({
                owner: msg.sender,
                nameHash: nameHash,
                tier: TIER_DAO,
                seatLimit: seatLimit,
                memberCount: 1,
                createdAt: uint64(block.timestamp),
                active: true
            })
        );
        teamId = _teams.length - 1;
        teamMembers[teamId][msg.sender] = true;
        _memberTeams[msg.sender].push(teamId);

        emit TeamCreated(teamId, msg.sender, nameHash, seatLimit);
        emit TeamMemberUpdated(teamId, msg.sender, true);
    }

    function getTeam(uint256 teamId)
        external
        view
        returns (
            address teamOwner,
            bytes32 nameHash,
            uint8 tier,
            uint16 seatLimit,
            uint16 memberCount,
            uint64 createdAt,
            bool active
        )
    {
        Team storage team = _team(teamId);
        return (
            team.owner,
            team.nameHash,
            team.tier,
            team.seatLimit,
            team.memberCount,
            team.createdAt,
            team.active
        );
    }

    function memberTeamAt(address account, uint256 index)
        external
        view
        returns (uint256)
    {
        if (index >= _memberTeams[account].length) revert BadIndex();
        return _memberTeams[account][index];
    }

    function setTeamActive(uint256 teamId, bool active) external {
        Team storage team = _team(teamId);
        if (msg.sender != owner() && msg.sender != team.owner) {
            revert NotTeamOwner();
        }
        team.active = active;
        emit TeamUpdated(teamId, active, team.seatLimit);
    }

    function setTeamSeatLimit(uint256 teamId, uint16 seatLimit) external {
        Team storage team = _team(teamId);
        if (msg.sender != owner() && msg.sender != team.owner) {
            revert NotTeamOwner();
        }
        if (seatLimit < team.memberCount || seatLimit > 200) revert BadSeats();
        team.seatLimit = seatLimit;
        emit TeamUpdated(teamId, team.active, seatLimit);
    }

    function addTeamMember(uint256 teamId, address member) external {
        Team storage team = _team(teamId);
        if (msg.sender != team.owner) revert NotTeamOwner();
        if (member == address(0)) revert ZeroAddress();
        if (!team.active) revert TeamInactive();
        if (team.memberCount >= team.seatLimit) revert SeatsFull();
        if (teamMembers[teamId][member]) return;

        teamMembers[teamId][member] = true;
        team.memberCount += 1;
        if (!_hasMemberTeam(member, teamId)) {
            _memberTeams[member].push(teamId);
        }
        emit TeamMemberUpdated(teamId, member, true);
    }

    function removeTeamMember(uint256 teamId, address member) external {
        Team storage team = _team(teamId);
        if (msg.sender != team.owner) revert NotTeamOwner();
        if (member == team.owner) revert OwnerSeatRequired();
        if (!teamMembers[teamId][member]) return;

        teamMembers[teamId][member] = false;
        team.memberCount -= 1;
        emit TeamMemberUpdated(teamId, member, false);
    }

    function recordAlert(
        address account,
        bytes32 ruleHash,
        uint256 signalId,
        string calldata channel,
        string calldata deliveryRef
    ) external onlyOwner returns (uint256 alertId) {
        if (account == address(0)) revert ZeroAddress();
        _signal(signalId);
        _alerts[account].push(
            AlertReceipt({
                ruleHash: ruleHash,
                signalId: signalId,
                channel: channel,
                deliveryRef: deliveryRef,
                createdAt: uint64(block.timestamp),
                read: false
            })
        );
        alertId = _alerts[account].length - 1;
        emit AlertRecorded(account, alertId, signalId, ruleHash);
    }

    function getAlert(address account, uint256 index)
        external
        view
        returns (
            bytes32 ruleHash,
            uint256 signalId,
            string memory channel,
            string memory deliveryRef,
            uint64 createdAt,
            bool read
        )
    {
        if (index >= _alerts[account].length) revert BadAlert();
        AlertReceipt storage alert = _alerts[account][index];
        return (
            alert.ruleHash,
            alert.signalId,
            alert.channel,
            alert.deliveryRef,
            alert.createdAt,
            alert.read
        );
    }

    function markAlertRead(uint256 index, bool read) external {
        if (index >= _alerts[msg.sender].length) revert BadAlert();
        _alerts[msg.sender][index].read = read;
        emit AlertReadUpdated(msg.sender, index, read);
    }

    function setAnalystScore(
        address analyst,
        InEuint32 calldata encryptedScoreBps
    ) external onlyOwner {
        euint32 score = FHE.asEuint32(encryptedScoreBps);
        FHE.allowThis(score);
        FHE.allow(score, owner());
        FHE.allow(score, analyst);

        _analystScores[analyst] = score;
        hasAnalystScore[analyst] = true;
        emit AnalystScoreUpdated(analyst);
    }

    function getAnalystScore(address analyst) external view returns (euint32) {
        if (!hasAnalystScore[analyst]) revert NoScore();
        return _analystScores[analyst];
    }

    function grantAnalystScoreAccess(address analyst) external {
        if (!hasAnalystScore[analyst]) revert NoScore();
        if (
            msg.sender != owner() &&
            msg.sender != analyst &&
            effectiveTier(msg.sender) < TIER_PRO
        ) {
            revert TierTooLow();
        }
        FHE.allow(_analystScores[analyst], msg.sender);
    }

    function setPublishCooldown(uint64 secondsBetweenPublishes) external onlyOwner {
        publishCooldownSeconds = secondsBetweenPublishes;
        emit PublishCooldownUpdated(secondsBetweenPublishes);
    }

    function withdraw(address payable recipient) external onlyOwner nonReentrant {
        if (recipient == address(0)) revert ZeroAddress();
        uint256 amount = address(this).balance;
        (bool sent, ) = recipient.call{value: amount}("");
        if (!sent) revert WithdrawFailed();
        emit TreasuryWithdrawal(recipient, amount);
    }

    function withdrawToken(
        address token,
        address recipient,
        uint256 amount
    ) external onlyOwner nonReentrant {
        if (token == address(0)) revert ZeroToken();
        if (recipient == address(0)) revert ZeroAddress();
        IERC20(token).safeTransfer(recipient, amount);
        emit TokenWithdrawal(token, recipient, amount);
    }

    receive() external payable {}

    function _createFeed(
        string memory name,
        string memory description,
        uint8 minTier,
        uint256 monthlyPriceWei,
        address curator
    ) internal returns (uint256 feedId) {
        _requireTier(minTier);
        if (curator == address(0)) revert ZeroAddress();
        _feeds.push(
            Feed({
                name: name,
                description: description,
                minTier: minTier,
                monthlyPriceWei: monthlyPriceWei,
                active: true,
                curator: curator
            })
        );
        feedId = _feeds.length - 1;
        emit FeedCreated(feedId, name, minTier, monthlyPriceWei);
    }

    function _requirePublishAllowed(uint256 feedId, uint8 minTier) internal view {
        _requireTier(minTier);
        Feed storage feed = _feed(feedId);
        if (!feed.active) revert FeedInactive();
        if (minTier < feed.minTier) revert BelowFeedTier();
        if (
            msg.sender != owner() &&
            msg.sender != feed.curator &&
            !approvedAnalysts[msg.sender]
        ) {
            revert AnalystNotApproved();
        }
        if (msg.sender != owner() && publishCooldownSeconds > 0) {
            if (
                block.timestamp <
                lastPublishedAt[msg.sender] + publishCooldownSeconds
            ) {
                revert PublishCooldown();
            }
        }
    }

    function _activateSubscription(
        address account,
        uint8 tier,
        uint8 monthCount,
        uint256 paid
    ) internal returns (uint64 expiresAt) {
        if (monthCount == 0 || monthCount > 12) revert BadDuration();

        Subscription storage subscription = _subscriptions[account];
        if (subscription.expiresAt >= block.timestamp) {
            if (tier < subscription.tier) revert ActiveDowngrade();
        }

        uint64 startsAt = subscription.expiresAt >= block.timestamp &&
            tier == subscription.tier
            ? subscription.expiresAt
            : uint64(block.timestamp);
        expiresAt = startsAt + uint64(monthCount) * MONTH;
        subscription.tier = tier;
        subscription.expiresAt = expiresAt;

        emit Subscribed(account, tier, expiresAt, paid);
    }

    function _recordReceipt(
        address account,
        address token,
        uint8 tier,
        uint8 monthCount,
        uint256 amount,
        uint64 expiresAt
    ) internal {
        _receipts[account].push(
            PaymentReceipt({
                payer: account,
                token: token,
                tier: tier,
                monthCount: monthCount,
                amount: amount,
                paidAt: uint64(block.timestamp),
                expiresAt: expiresAt
            })
        );
        emit PaymentReceiptRecorded(
            account,
            _receipts[account].length - 1,
            token,
            tier,
            monthCount,
            amount
        );
    }

    function _setAnalystProfile(
        address analyst,
        string calldata displayName,
        string calldata bio,
        string calldata strategy,
        string calldata uri,
        bool active
    ) internal {
        _analystProfiles[analyst] = AnalystProfile({
            displayName: displayName,
            bio: bio,
            strategy: strategy,
            uri: uri,
            updatedAt: uint64(block.timestamp),
            active: active
        });
        hasAnalystProfile[analyst] = true;
        emit AnalystProfileUpdated(analyst, displayName);
    }

    function _allowSignalHandles(
        eaddress whale,
        euint64 amountUsd,
        euint32 confidenceBps,
        euint32 entryPriceBps,
        euint32 riskBps,
        address account
    ) internal {
        FHE.allowThis(whale);
        FHE.allowThis(amountUsd);
        FHE.allowThis(confidenceBps);
        FHE.allowThis(entryPriceBps);
        FHE.allowThis(riskBps);

        FHE.allow(whale, account);
        FHE.allow(amountUsd, account);
        FHE.allow(confidenceBps, account);
        FHE.allow(entryPriceBps, account);
        FHE.allow(riskBps, account);
    }

    function _feed(uint256 feedId) internal view returns (Feed storage) {
        if (feedId >= _feeds.length) revert BadFeed();
        return _feeds[feedId];
    }

    function _signal(uint256 signalId) internal view returns (Signal storage) {
        if (signalId >= _signals.length) revert BadSignal();
        return _signals[signalId];
    }

    function _team(uint256 teamId) internal view returns (Team storage) {
        if (teamId >= _teams.length) revert BadTeam();
        return _teams[teamId];
    }

    function _watchlistItem(address account, uint256 index)
        internal
        view
        returns (WatchlistItem storage)
    {
        if (index >= _watchlists[account].length) revert BadIndex();
        return _watchlists[account][index];
    }

    function _hasMemberTeam(address member, uint256 teamId)
        internal
        view
        returns (bool)
    {
        uint256[] storage teamIds = _memberTeams[member];
        for (uint256 i = 0; i < teamIds.length; i++) {
            if (teamIds[i] == teamId) return true;
        }
        return false;
    }

    function _requireTier(uint8 tier) internal pure {
        if (tier > TIER_DAO) revert BadTier();
    }

    function _requirePaidTier(uint8 tier) internal pure {
        if (tier < TIER_PRO || tier > TIER_DAO) revert BadTier();
    }
}
