// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract HydrogenCredits {
    address public admin;
    mapping(address => uint256) public balances;
    mapping(address => bool) public registeredUsers;

    constructor() {
        admin = msg.sender; // whoever deploys is the admin
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can call this");
        _;
    }

    function registerUser(address user) public onlyAdmin {
        require(!registeredUsers[user], "User already registered");
        registeredUsers[user] = true;
        balances[user] = 0;
    }

    function creditUser(address user, uint256 amount) public onlyAdmin {
        require(registeredUsers[user], "User not registered");
        balances[user] += amount;
    }

    function getBalance(address user) public view returns (uint256) {
        return balances[user];
    }
}
