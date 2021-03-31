// SPDX-License-Identifier: MIT
/*
 * MIT License
 * ===========
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 */
pragma solidity 0.7.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "../interfaces/IPendleLpHolder.sol";
import "../interfaces/IPendleRouter.sol";

contract PendleLpHolder is IPendleLpHolder {
    using SafeERC20 for IERC20;

    address private pendleLiquidityMining;
    address private underlyingYieldToken;
    address private pendleMarket;
    address private router;

    constructor(
        address _pendleMarket,
        address _router,
        address _underlyingYieldToken
    ) {
        pendleMarket = _pendleMarket;
        router = _router;
        pendleLiquidityMining = msg.sender;
        underlyingYieldToken = _underlyingYieldToken;
    }

    function sendLp(address user, uint256 amount) external override {
        require(msg.sender == pendleLiquidityMining, "NOT_AUTHORIZED");
        IERC20(pendleMarket).safeTransfer(user, amount);
    }

    function sendInterests(address user, uint256 amount) external override {
        require(msg.sender == pendleLiquidityMining, "NOT_AUTHORIZED");
        IERC20(underlyingYieldToken).safeTransfer(user, amount);
    }

    function claimLpInterests() external override {
        require(msg.sender == pendleLiquidityMining, "NOT_AUTHORIZED");
        address[] memory array = new address[](1);
        array[0] = pendleMarket;
        IPendleRouter(router).claimLpInterests(array);
    }
}
