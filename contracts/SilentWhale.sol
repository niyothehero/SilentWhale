// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@fhenixprotocol/cofhe-contracts/FHE.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract SilentWhale is Ownable {
    uint8 public constant TIER_FREE = 0;
    uint8 public constant TIER_PRO = 1;
    uint8 public constant TIER_ELITE = 2;
    uint8 public constant TIER_DAO = 3;
    uint64 public constant MONTH = 30 days;

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
        uint8 minTier;
        uint64 createdAt;
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

    Feed[] private _feeds;
    Signal[] private _signals;

    mapping(address => Subscription) private _subscriptions;
    mapping(uint8 => uint256) public tierPriceWei;
    mapping(address => uint256[]) private _analystSignals;
    mapping(address => WatchlistItem[]) private _watchlists;
    mapping(address => euint32) private _analystScores;
    mapping(address => bool) public hasAnalystScore;
    mapping(address => bool) public approvedAnalysts;

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
    event WatchlistItemAdded(address indexed account, uint256 indexed index);
    event WatchlistAccessGranted(address indexed account, uint256 indexed index);
    event AnalystScoreUpdated(address indexed analyst);
    event AnalystStatusUpdated(address indexed analyst, bool approved);
    event TierPriceUpdated(uint8 indexed tier, uint256 monthlyPriceWei);

    constructor(address initialOwner) Ownable(initialOwner) {
        approvedAnalysts[initialOwner] = true;
        tierPriceWei[TIER_PRO] = 0.001 ether;
        tierPriceWei[TIER_ELITE] = 0.003 ether;
        tierPriceWei[TIER_DAO] = 0.01 ether;

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

    function analystSignalCount(address analyst) external view returns (uint256) {
        return _analystSignals[analyst].length;
    }

    function watchlistCount(address account) external view returns (uint256) {
        return _watchlists[account].length;
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
        require(curator != address(0), "SilentWhale: zero curator");
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
        uint8 minTier,
        InEaddress calldata encryptedWhale,
        InEuint64 calldata encryptedAmountUsd,
        InEuint32 calldata encryptedConfidenceBps,
        InEuint32 calldata encryptedEntryPriceBps,
        InEuint32 calldata encryptedRiskBps
    ) external returns (uint256 signalId) {
        _requireTier(minTier);
        Feed storage feed = _feed(feedId);
        require(feed.active, "SilentWhale: feed inactive");
        require(minTier >= feed.minTier, "SilentWhale: below feed tier");
        require(
            msg.sender == owner() ||
                msg.sender == feed.curator ||
                approvedAnalysts[msg.sender],
            "SilentWhale: analyst not approved"
        );

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
                minTier: minTier,
                createdAt: uint64(block.timestamp),
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
            uint8 minTier,
            uint64 createdAt,
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
            signal.minTier,
            signal.createdAt,
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
        require(index < _analystSignals[analyst].length, "SilentWhale: bad index");
        return _analystSignals[analyst][index];
    }

    function setSignalActive(uint256 signalId, bool active) external {
        Signal storage signal = _signal(signalId);
        require(
            msg.sender == owner() || msg.sender == signal.analyst,
            "SilentWhale: not signal admin"
        );
        signal.active = active;
    }

    function grantSignalAccess(uint256 signalId) external {
        require(canAccessSignal(msg.sender, signalId), "SilentWhale: tier too low");
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

    function subscribe(uint8 tier, uint8 monthCount) external payable {
        _requirePaidTier(tier);
        require(monthCount > 0 && monthCount <= 12, "SilentWhale: bad duration");

        uint256 price = tierPriceWei[tier] * monthCount;
        require(price > 0, "SilentWhale: tier unavailable");
        require(msg.value >= price, "SilentWhale: underpaid");

        Subscription storage subscription = _subscriptions[msg.sender];
        if (subscription.expiresAt >= block.timestamp) {
            require(tier >= subscription.tier, "SilentWhale: active downgrade");
        }

        uint64 startsAt = subscription.expiresAt >= block.timestamp
            ? subscription.expiresAt
            : uint64(block.timestamp);
        uint64 expiresAt = startsAt + uint64(monthCount) * MONTH;
        subscription.tier = tier;
        subscription.expiresAt = expiresAt;

        uint256 refund = msg.value - price;
        if (refund > 0) {
            (bool sent, ) = msg.sender.call{value: refund}("");
            require(sent, "SilentWhale: refund failed");
        }

        emit Subscribed(msg.sender, tier, expiresAt, price);
    }

    function grantSubscription(
        address account,
        uint8 tier,
        uint64 expiresAt
    ) external onlyOwner {
        _requirePaidTier(tier);
        require(expiresAt > block.timestamp, "SilentWhale: expiry in past");
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

    function effectiveTier(address account) public view returns (uint8) {
        Subscription storage subscription = _subscriptions[account];
        if (subscription.expiresAt >= block.timestamp) {
            return subscription.tier;
        }
        return TIER_FREE;
    }

    function setTierPrice(uint8 tier, uint256 monthlyPriceWei) external onlyOwner {
        _requirePaidTier(tier);
        tierPriceWei[tier] = monthlyPriceWei;
        emit TierPriceUpdated(tier, monthlyPriceWei);
    }

    function setAnalystStatus(address analyst, bool approved) external onlyOwner {
        require(analyst != address(0), "SilentWhale: zero analyst");
        approvedAnalysts[analyst] = approved;
        emit AnalystStatusUpdated(analyst, approved);
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
        require(item.active, "SilentWhale: item inactive");
        FHE.allow(item.encryptedWallet, msg.sender);
        FHE.allow(item.encryptedMinConfidenceBps, msg.sender);
        emit WatchlistAccessGranted(msg.sender, index);
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
        require(hasAnalystScore[analyst], "SilentWhale: no score");
        return _analystScores[analyst];
    }

    function grantAnalystScoreAccess(address analyst) external {
        require(hasAnalystScore[analyst], "SilentWhale: no score");
        require(
            msg.sender == owner() ||
                msg.sender == analyst ||
                effectiveTier(msg.sender) >= TIER_PRO,
            "SilentWhale: tier too low"
        );
        FHE.allow(_analystScores[analyst], msg.sender);
    }

    function withdraw(address payable recipient) external onlyOwner {
        require(recipient != address(0), "SilentWhale: zero recipient");
        (bool sent, ) = recipient.call{value: address(this).balance}("");
        require(sent, "SilentWhale: withdraw failed");
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
        require(curator != address(0), "SilentWhale: zero curator");
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
        require(feedId < _feeds.length, "SilentWhale: bad feed");
        return _feeds[feedId];
    }

    function _signal(uint256 signalId) internal view returns (Signal storage) {
        require(signalId < _signals.length, "SilentWhale: bad signal");
        return _signals[signalId];
    }

    function _watchlistItem(address account, uint256 index)
        internal
        view
        returns (WatchlistItem storage)
    {
        require(index < _watchlists[account].length, "SilentWhale: bad index");
        return _watchlists[account][index];
    }

    function _requireTier(uint8 tier) internal pure {
        require(tier <= TIER_DAO, "SilentWhale: bad tier");
    }

    function _requirePaidTier(uint8 tier) internal pure {
        require(tier >= TIER_PRO && tier <= TIER_DAO, "SilentWhale: bad tier");
    }
}
