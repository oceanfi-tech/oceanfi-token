// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v4.5.0) (token/OceanFiERC20.sol.sol/extensions/OceanFiERC20Burnable.sol.sol)

pragma solidity ^0.8.0;

import "./OceanFiERC20.sol";
import "@openzeppelin/contracts/utils/Context.sol";

/**
 * @dev Extension of {OceanFiERC20.sol.sol} that allows token holders to destroy both their own
 * tokens and those that they have an allowance for, in a way that can be
 * recognized off-chain (via event analysis).
 */
abstract contract OceanFiERC20Burnable is Context, OceanFiERC20 {
    /**
     * @dev Destroys `amount` tokens from the caller.
     *
     * See {OceanFiERC20.sol.sol-_burn}.
     */
    function burn(uint256 amount) public virtual {
        _burn(_msgSender(), amount);
    }

    /**
     * @dev Destroys `amount` tokens from `account`, deducting from the caller's
     * allowance.
     *
     * See {OceanFiERC20.sol.sol-_burn} and {OceanFiERC20.sol.sol.sol-allowance}.
     *
     * Requirements:
     *
     * - the caller must have allowance for ``accounts``'s tokens of at least
     * `amount`.
     */
    function burnFrom(address account, uint256 amount) public virtual {
        _spendAllowance(account, _msgSender(), amount);
        _burn(account, amount);
    }
}
