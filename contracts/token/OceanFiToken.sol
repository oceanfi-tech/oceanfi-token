// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

import "./OceanFiERC20.sol";
import "./OceanFiERC20Burnable.sol";
import "../oracle/IOracle.sol";

contract OceanFiToken is OceanFiERC20, OceanFiERC20Burnable {
    uint256 public constant SECONDS_PER_DAY = 86400;

    address private _contractOwner;

    address public _oracle;
    uint256 public _buyLimit; // usd with decimal
    uint256 public _sellLimit; // usd with decimal

    mapping(address => bool) public _pancakeLps;
    mapping(address => bool) private _addressExcludeLimit;

    // wallet -> date buy -> total amount
    mapping(address => mapping(uint256 => uint256)) private _sellAmounts;
    mapping(address => mapping(uint256 => uint256)) private _buyAmounts;

    constructor() OceanFiERC20("Oceanfi", "OCF") {
        _mint(msg.sender, 28_000_000 * 10 ** decimals());
    }

    modifier checkOwner() {
        require(owner() == _msgSender() || _contractOwner == _msgSender(), "TOKEN: CALLER IS NOT THE OWNER");
        _;
    }

    function convertTokenToUsdt(uint256 amount) internal view returns (uint256) {
        uint256 usdAmount = 1000000;
        uint256 tokenAmount = IOracle(_oracle).convertUsdBalanceDecimalToTokenDecimal(usdAmount);

        return (amount * usdAmount) / tokenAmount;
    }

    function checkSellLimit(address wallet, uint256 amount) internal returns (bool) {
        amount = convertTokenToUsdt(amount);
        if (amount > _sellLimit) {
            return false;
        }

        uint256 currentDate = block.timestamp / SECONDS_PER_DAY;
        uint256 valueAfterSell = _sellAmounts[wallet][currentDate] + amount;

        if (valueAfterSell > _sellLimit) {
            return false;
        }

        _sellAmounts[wallet][currentDate] = valueAfterSell;
        return true;
    }

    function checkBuyLimit(address wallet, uint256 amount) internal returns (bool) {
        amount = convertTokenToUsdt(amount);
        if (amount > _buyLimit) {
            return false;
        }

        uint256 currentDate = block.timestamp / SECONDS_PER_DAY;
        uint256 valueAfterBuy = _buyAmounts[wallet][currentDate] + amount;

        if (valueAfterBuy > _buyLimit) {
            return false;
        }

        _buyAmounts[wallet][currentDate] = valueAfterBuy;
        return true;
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount) internal override {
        if (_buyLimit != 0 && _pancakeLps[from] && !_addressExcludeLimit[to]) {
            require(checkBuyLimit(to, amount), "TOKEN: BUY LIMIT");
        } else {
            if (_sellLimit != 0 && _pancakeLps[to] && !_addressExcludeLimit[from]) {
                require(checkSellLimit(from, amount), "TOKEN: SELL LIMIT");
            }
        }
    }

    function setPancakeLp(address addr, bool isLp) external checkOwner {
        require(addr != address(0), "TOKEN: addr is zero address");
        _pancakeLps[addr] = isLp;
    }

    function setAddressExcludeLimit(address addr, bool isExcludeLimit) external checkOwner {
        require(addr != address(0), "TOKEN: addr is zero address");
        _addressExcludeLimit[addr] = isExcludeLimit;
    }

    function setSellLimit(uint256 sellLimit) external checkOwner {
        _sellLimit = sellLimit;
    }

    function setBuyLimit(uint256 buyLimit) external checkOwner {
        _buyLimit = buyLimit;
    }

    function setOracle(address newOracle) external checkOwner {
        require(newOracle != address(0), "TOKEN: newOracle is zero address");
        _oracle = newOracle;
    }

    function setContractOwner(address newContractOwner) external checkOwner {
        _contractOwner = newContractOwner;
    }

    /**
     * @dev Recover lost bnb and send it to the contract owner
     */
    function recoverLostBNB() public onlyOwner {
        address payable recipient = payable(msg.sender);
        recipient.transfer(address(this).balance);
    }

    /**
     * @dev withdraw some token balance from contract to owner account
     */
    function withdrawTokenEmergency(address _token, uint256 _amount) public onlyOwner {
        require(_amount > 0, "TOKEN: INVALID AMOUNT");
        require(IERC20(_token).transfer(msg.sender, _amount), "TOKEN: CANNOT WITHDRAW TOKEN");
    }
}
