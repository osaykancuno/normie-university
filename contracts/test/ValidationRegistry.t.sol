// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test}               from "forge-std/Test.sol";
import {ValidationRegistry} from "../src/reputation/ValidationRegistry.sol";
import {IAccessControl}     from "@openzeppelin/contracts/access/IAccessControl.sol";
import {
    SkillAI__ZeroAddress,
    SkillAI__ValidationNotRequested,
    SkillAI__ValidationAlreadyCompleted,
    SkillAI__NotRequestedValidator,
    SkillAI__ValidatorNotAuthorized,
    SkillAI__InvalidValidationResponse
} from "../src/libraries/SkillTypes.sol";

contract ValidationRegistryTest is Test {
    ValidationRegistry public reg;

    address public admin     = address(0xA11CE);
    address public validator = address(0xBEEF);
    address public agent     = address(0xAAAA);
    address public attacker  = address(0xDEAD);

    bytes32 constant H1 = keccak256("payload-1");
    bytes32 constant H2 = keccak256("payload-2");

    function setUp() public {
        reg = new ValidationRegistry(admin);
        vm.prank(admin);
        reg.grantValidatorRole(validator);
    }

    // =========================================================================
    //                            CONSTRUCTOR
    // =========================================================================

    function test_Constructor_RevertsOnZeroAddress() public {
        vm.expectRevert(SkillAI__ZeroAddress.selector);
        new ValidationRegistry(address(0));
    }

    function test_Constructor_SetsAdmin() public view {
        assertTrue(reg.hasRole(reg.ADMIN_ROLE(), admin));
    }

    // =========================================================================
    //                        VALIDATION REQUEST
    // =========================================================================

    function test_Request_HappyPath() public {
        vm.prank(address(this));
        reg.validationRequest(validator, agent, H1, 42);

        (address v, address a, uint256 sid, uint8 resp, bool done,,) = reg.getValidation(H1);
        assertEq(v, validator);
        assertEq(a, agent);
        assertEq(sid, 42);
        assertEq(resp, 0);
        assertFalse(done);
    }

    function test_Request_RevertsOnUnauthorizedValidator() public {
        vm.expectRevert(abi.encodeWithSelector(
            SkillAI__ValidatorNotAuthorized.selector, attacker
        ));
        reg.validationRequest(attacker, agent, H1, 1);
    }

    function test_Request_RevertsOnDuplicate() public {
        reg.validationRequest(validator, agent, H1, 1);

        vm.expectRevert(abi.encodeWithSelector(
            SkillAI__ValidationAlreadyCompleted.selector, H1
        ));
        reg.validationRequest(validator, agent, H1, 1);
    }

    function test_Request_RevertsOnZeroAddress() public {
        vm.expectRevert(SkillAI__ZeroAddress.selector);
        reg.validationRequest(address(0), agent, H1, 1);
    }

    // =========================================================================
    //                        VALIDATION RESPONSE
    // =========================================================================

    function test_Response_HappyPath() public {
        reg.validationRequest(validator, agent, H1, 1);

        vm.prank(validator);
        reg.validationResponse(H1, 90);

        (,,, uint8 resp, bool done,,) = reg.getValidation(H1);
        assertEq(resp, 90);
        assertTrue(done);
        assertTrue(reg.isValidated(H1));
        assertEq(reg.completedValidationsOf(agent), 1);
        assertEq(reg.averageValidationScore(agent), 90);
    }

    function test_Response_RevertsForWrongValidator() public {
        reg.validationRequest(validator, agent, H1, 1);

        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(
            SkillAI__NotRequestedValidator.selector, attacker, validator
        ));
        reg.validationResponse(H1, 90);
    }

    function test_Response_RevertsIfNotRequested() public {
        vm.prank(validator);
        vm.expectRevert(abi.encodeWithSelector(
            SkillAI__ValidationNotRequested.selector, H1
        ));
        reg.validationResponse(H1, 50);
    }

    function test_Response_RevertsOnDoubleSubmit() public {
        reg.validationRequest(validator, agent, H1, 1);
        vm.prank(validator);
        reg.validationResponse(H1, 80);

        vm.prank(validator);
        vm.expectRevert(abi.encodeWithSelector(
            SkillAI__ValidationAlreadyCompleted.selector, H1
        ));
        reg.validationResponse(H1, 90);
    }

    function test_Response_RevertsOnInvalidScore() public {
        reg.validationRequest(validator, agent, H1, 1);
        vm.prank(validator);
        vm.expectRevert(abi.encodeWithSelector(
            SkillAI__InvalidValidationResponse.selector, uint8(101)
        ));
        reg.validationResponse(H1, 101);
    }

    // =========================================================================
    //                    AGGREGATE AVERAGES
    // =========================================================================

    function test_Aggregate_MultipleResponses() public {
        reg.validationRequest(validator, agent, H1, 1);
        reg.validationRequest(validator, agent, H2, 2);

        vm.prank(validator); reg.validationResponse(H1, 80);
        vm.prank(validator); reg.validationResponse(H2, 60);

        assertEq(reg.completedValidationsOf(agent), 2);
        assertEq(reg.averageValidationScore(agent), 70);
    }

    function test_AverageScore_ZeroWhenNone() public view {
        assertEq(reg.averageValidationScore(agent), 0);
    }

    // =========================================================================
    //                           ADMIN ROLES
    // =========================================================================

    function test_RevokeValidator_BlocksFutureRequests() public {
        vm.prank(admin);
        reg.revokeValidatorRole(validator);

        vm.expectRevert(abi.encodeWithSelector(
            SkillAI__ValidatorNotAuthorized.selector, validator
        ));
        reg.validationRequest(validator, agent, H1, 1);
    }

    function test_GrantValidator_OnlyAdmin() public {
        bytes32 adminRole = reg.ADMIN_ROLE();
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(
            IAccessControl.AccessControlUnauthorizedAccount.selector,
            attacker,
            adminRole
        ));
        reg.grantValidatorRole(address(0xFEED));
    }
}
