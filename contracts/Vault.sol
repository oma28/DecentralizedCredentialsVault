// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

contract Vault {

    struct Backup {
        uint256 createdAt;
        uint256 updatedAt;
        bool allowedOverwrite;
        bool deprecated;
        string cid;
        string description;
    }

    address public immutable masterAddress;

    mapping(address => mapping(string => Backup)) public backups;
    mapping(address => string[]) backupKeys;
    mapping(address => bool) public isAuthorized;

    event BackupCreated(address indexed owner, uint256 indexed createdAt, string cid, string key);
    event BackupUpdated(address indexed owner, uint256 indexed updatedAt, string cid, string key);
    event BackupDeprecated(address indexed owner, uint256 indexed deprecatedAt, string cid, string key);
    event Authorized(address indexed addr);
    event Deauthorized(address indexed addr);

    modifier onlyAuthorized() {
        require(isAuthorized[msg.sender], "Vault: You are not authorized");
        require(msg.sender != masterAddress, "Vault: Master is not allowed");
        _;
    }

    modifier validAuthorization(address addr) {
        require(msg.sender == masterAddress, "Vault: Only master address");
        require(addr != address(0), "Vault: Zero address");
        require(addr != masterAddress, "Vault: Forbidden address");
        _;
    }

    constructor() {
        masterAddress = msg.sender;
    }

    function createBackup(
        string calldata _key,
        string calldata _cid,
        string calldata _description,
        bool _allowedOverwrite
    ) onlyAuthorized external {
        address owner = msg.sender;

        require(bytes(_cid).length > 0, "Vault: Empty CID");
        require(bytes(_key).length > 0, "Vault: Empty key");
        require(!isExist(owner, _key), "Vault: This key is used");
        
        uint256 createdAt = block.timestamp;

        backupKeys[owner].push(_key);

        backups[owner][_key] = Backup({
            createdAt: createdAt,
            updatedAt: createdAt,
            cid: _cid,
            description: _description,
            allowedOverwrite: _allowedOverwrite,
            deprecated: false
        });

        emit BackupCreated(owner, createdAt, _cid, _key);
    }

    function updateBackup(
        string calldata _key, 
        string calldata _cid,
        string calldata _newDescription
    ) onlyAuthorized external {
        address owner = msg.sender;
        require(bytes(_cid).length > 0, "Vault: Empty CID");
        require(isExist(owner, _key), "Vault: Backup not found");

        Backup storage backup = backups[owner][_key];
        require(!backup.deprecated, "Vault: Backup is deprecated");
        require(backup.allowedOverwrite, "Vault: Overwrite is forbidden");

        uint256 updatedAt = block.timestamp;
        backup.cid = _cid;
        backup.description = _newDescription;
        backup.updatedAt = updatedAt;

        emit BackupUpdated(owner, updatedAt, backup.cid, _key);
    }

    function deprecateBackup(string calldata _key) onlyAuthorized external {
        address owner = msg.sender;
        require(isExist(owner, _key), "Vault: Backup not found");

        Backup storage backup = backups[owner][_key];
        require(!backup.deprecated, "Vault: Already deprecated");

        uint256 deprecatedAt = block.timestamp;
        backup.deprecated = true;

        emit BackupDeprecated(owner, deprecatedAt, backup.cid, _key);
    }

    function authorize(address addr) validAuthorization(addr) external {
        require(!isAuthorized[addr], "Vault: Already authorized");
        isAuthorized[addr] = true;
        emit Authorized(addr);
    }

    function deauthorize(address addr) validAuthorization(addr) external {
        require(isAuthorized[addr], "Vault: Already deauthorized");
        isAuthorized[addr] = false;
        emit Deauthorized(addr);
    } 

    function getBackup(string calldata _key) external view returns (
        uint256 createdAt,
        uint256 updatedAt,
        bool allowedOverwrite,
        bool deprecated,
        string memory cid,
        string memory description
    ) {
        address owner = msg.sender;
        require(bytes(_key).length > 0, "Vault: Key is empty");
        require(isExist(owner, _key), "Vault: Backup not found");

        Backup memory b = backups[owner][_key];
        return (b.createdAt, b.updatedAt, b.allowedOverwrite, b.deprecated, b.cid, b.description);
    }

    function getAllKeys() external view returns (string[] memory) {
        return backupKeys[msg.sender];
    }

    function isExist(address owner, string calldata _key) internal view returns (bool) {
        return bytes(backups[owner][_key].cid).length > 0;
    }
}