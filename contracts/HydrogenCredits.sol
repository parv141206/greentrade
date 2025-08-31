// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract HydrogenCredits {
    address public admin;
    mapping(address => uint256) public balances;
    mapping(address => bool) public registeredUsers;

    event TokensTransferred(address indexed from, address indexed to, uint256 amount);
    event CreditsRetired(address indexed user, uint256 amount); // New event for retiring credits

    constructor() {
        admin = msg.sender; // The deployer is the admin
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can call this function");
        _;
    }

    function registerUser(address user) public onlyAdmin {
        require(!registeredUsers[user], "User is already registered");
        registeredUsers[user] = true;
        balances[user] = 0;
    }

    function creditUser(address user, uint256 amount) public onlyAdmin {
        require(registeredUsers[user], "User is not registered");
        balances[user] += amount;
    }

    function getBalance(address user) public view returns (uint256) {
        return balances[user];
    }
    
    function transferTokens(address from, address to, uint256 amount) public onlyAdmin {
        require(registeredUsers[from], "Sender is not a registered user");
        require(registeredUsers[to], "Recipient is not a registered user");
        require(balances[from] >= amount, "Insufficient balance to transfer");

        balances[from] -= amount;
        balances[to] += amount;

        emit TokensTransferred(from, to, amount);
    }

    /**
     * @notice Retires a specific amount of credits from a user's balance.
     * @dev This function can only be called by the admin (backend server).
     * It is intended to be used by an automated process (cron job) to
     * enforce daily credit expiration or retirement rules.
     * @param user The address of the user whose credits will be retired.
     * @param amount The number of credits to retire.
     */
    function retireCredits(address user, uint256 amount) public onlyAdmin {
        require(registeredUsers[user], "User is not a registered user");
        require(balances[user] >= amount, "Insufficient balance to retire");

        balances[user] -= amount;

        emit CreditsRetired(user, amount);
    }
}
