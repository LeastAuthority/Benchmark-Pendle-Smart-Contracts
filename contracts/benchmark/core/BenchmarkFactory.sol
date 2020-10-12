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
pragma solidity ^0.7.0;


import "./AddressesProvider.sol";
import "./BenchmarkForge.sol";
import "../interfaces/IBenchmarkFactory.sol";


contract BenchmarkFactory is IBenchmarkFactory {

    mapping(address => address) public override getForge;
    address public governance;
    address[] private allForges;
    AddressesProvider addressesProvider;

    constructor(address _governance, AddressesProvider _addressesProvider) {
        governance = _governance;
        addressesProvider = _addressesProvider;
    }

    function getAllForges() public override view returns (address[] memory) {
      return allForges;
    }

    // TODO: Check if the underlyingToken is available in Aave
    function createForge(address underlyingToken) external override returns (address forge) {
      require(underlyingToken != address(0), "zero address");
      require(getForge[underlyingToken] == address(0), "forge exists");

      bytes memory bytecode = type(BenchmarkForge).creationCode;
      bytes32 salt = keccak256(abi.encodePacked(underlyingToken));

      assembly {
          forge := create2(0, add(bytecode, 32), mload(bytecode), salt)
      }

      IBenchmarkForge(forge).initialize(underlyingToken, addressesProvider);
      getForge[underlyingToken] = forge;
      allForges.push(forge);

      emit ForgeCreated(underlyingToken, forge);
    }

    function allForgesLength() external view override returns (uint256) {
      return allForges.length;
    }
}