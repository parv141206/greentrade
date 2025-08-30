// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract HydrogenCredits {
    address public admin;
    mapping(address => uint256) public balances;
    mapping(address => bool) public registeredUsers;

    event TokensTransferred(address indexed from, address indexed to, uint256 amount);

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

    /**
     * @notice Transfer tokens between two registered users.
     * @dev This function can only be called by the admin (backend server),
     * which orchestrates the transfer on behalf of the users.
     * @param from The address of the seller.
     * @param to The address of the buyer.
     * @param amount The number of credits to transfer.
     */
    function transferTokens(address from, address to, uint256 amount) public onlyAdmin {
        require(registeredUsers[from], "Sender is not a registered user");
        require(registeredUsers[to], "Recipient is not a registered user");
        require(balances[from] >= amount, "Insufficient balance to transfer");

        balances[from] -= amount;
        balances[to] += amount;

        emit TokensTransferred(from, to, amount);
    }
}
