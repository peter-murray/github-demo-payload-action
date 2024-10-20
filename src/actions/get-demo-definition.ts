import * as core from '@actions/core';
import * as github from '@actions/github';
import { inspect } from 'util';
import { getRequiredInput, setOutput } from '../action-utils.js';
import { DemoDeployment } from '../DemoDeployment.js';
import { GitHubDeploymentManager } from '../GitHubDeploymentManager.js';
import * as githubResolver from '../GitHubResolver.js';
import { getOctokit } from '../util.js';

async function run() {
  try {
    await exec();
  } catch (err: any) {
    core.debug(inspect(err))
    core.setFailed(err);
  }
}
run();


async function exec() {
  const deploymentId = getRequiredInput('deployment_id');
  const githubUrl = getRequiredInput('github_server_url');

  const githubDetails = githubResolver.resolve(githubUrl);

  const octokit = getOctokit(getRequiredInput('github_token'));
  const deploymentManager = new GitHubDeploymentManager(github.context.repo, octokit, github.context.ref);

  const demoDeployment: DemoDeployment = await deploymentManager.getDemoDeploymentById(Number.parseInt(deploymentId));

  core.startGroup('Demo Deployment');
  setOutput('demo_deployment_id', demoDeployment.id);
  setOutput('demo_deployment_name', demoDeployment.name);
  setOutput('demo_deployment_description', demoDeployment.description);

  const uuid = demoDeployment.uuid;
  if (uuid) {
    setOutput('demo_deployment_uuid', uuid);
  }

  const trackingIssue = demoDeployment.getTrackingIssue();
  if (trackingIssue) {
    setOutput('communication_issue_number', trackingIssue);
  }

  const demoPayload = demoDeployment.payload;
  if (demoPayload) {
    setOutput('demo_deployment_payload_json', JSON.stringify(demoPayload));

    setOutput('demo_deployment_payload_version', demoPayload.version);

    setOutput('demo_deployment_payload_template_type', demoPayload.templateType);
    setOutput('demo_deployment_payload_template_json', demoPayload.templateJsonString);

    setOutput('demo_deployment_payload_requestor', demoPayload.actor);
    setOutput('demo_deployment_payload_demo_config_json', demoPayload.additionConfigJsonString);

    const repo = demoPayload.repository;
    setOutput('demo_deployment_github_repository_owner', repo.owner);
    setOutput('demo_deployment_github_repository_name', repo.repo);
    setOutput('demo_deployment_github_repository_full_name', `${repo.owner}/${repo.repo}`);

    const demoParameters = {
      version: demoPayload.version,
      github_repository: repo,
      requestor_handle: demoPayload.actor,
      uuid: demoPayload.uuid,
      communication_issue_number: demoPayload.communicationIssueNumber,
      demo_config_json: JSON.stringify(demoPayload.additionalConfig || {}),
      demo_definition_json: demoPayload.demoTemplate.asJsonString,

      github_instance_type: githubDetails.type,
      github_instance_urls_json: JSON.stringify({
        base_url: githubDetails.base_url,
        api_url: githubDetails.api_url,
        terraform_api_url: githubDetails.terraform_api_url,
        container_registry_url: githubDetails.container_registry_url,
      }),
    };

    if (githubDetails.tenant_name) {
      demoParameters['github_instance_tenant_name'] = githubDetails.tenant_name;
    }

    const demo_parameters_payload = JSON.stringify(demoParameters);
    setOutput('demo_deployment_demo_parameters_json', demo_parameters_payload);
    setOutput('demo_deployment_demo_parameters_json_b64', Buffer.from(demo_parameters_payload).toString('base64'));
  }
  core.endGroup();
}
