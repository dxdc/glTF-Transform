import { Extension, MathUtils, ReaderContext, WriterContext, vec3 } from '@gltf-transform/core';
import { KHR_LIGHTS_PUNCTUAL } from '../constants';
import { Light } from './light';

const NAME = KHR_LIGHTS_PUNCTUAL;

interface LightsPunctualRootDef {
	lights?: LightDef[];
}

interface LightsPunctualNodeDef {
	light: number;
}

interface LightDef {
	name?: string;
	color?: vec3;
	intensity?: number;
	range?: number;
	innerConeAngle?: number;
	outerConeAngle?: number;
	type: 'spot' | 'point' | 'directional'
}

/** Documentation in {@link EXTENSIONS.md}. */
export class LightsPunctual extends Extension {
	public readonly extensionName = NAME;
	public static readonly EXTENSION_NAME = NAME;

	public createLight(): Light {
		return new Light(this.doc.getGraph(), this);
	}

	public read(context: ReaderContext): this {
		const jsonDoc = context.jsonDoc;

		if (!jsonDoc.json.extensions || !jsonDoc.json.extensions[NAME]) return this;

		const rootDef = jsonDoc.json.extensions[NAME] as LightsPunctualRootDef;
		const lightDefs = rootDef.lights || [] as LightDef[];
		const lights = lightDefs.map((lightDef) => {
			const light = this.createLight()
				.setName(lightDef.name || '')
				.setType(lightDef.type);

			if (lightDef.color !== undefined) light.setColor(lightDef.color);
			if (lightDef.intensity !== undefined) light.setIntensity(lightDef.intensity);
			if (lightDef.range !== undefined) light.setRange(lightDef.range);

			if (lightDef.innerConeAngle !== undefined) {
				light.setInnerConeAngle(lightDef.innerConeAngle);
			}
			if (lightDef.outerConeAngle !== undefined) {
				light.setOuterConeAngle(lightDef.outerConeAngle);
			}

			return light;
		});

		jsonDoc.json.nodes!.forEach((nodeDef, nodeIndex) => {
			if (!nodeDef.extensions || !nodeDef.extensions[NAME]) return;
			const lightNodeDef = nodeDef.extensions[NAME] as LightsPunctualNodeDef;
			context.nodes[nodeIndex].setExtension(NAME, lights[lightNodeDef.light]);
		});

		return this;
	}

	public write(context: WriterContext): this {
		const jsonDoc = context.jsonDoc;

		if (this.properties.size === 0) return this;

		const lightDefs = [];
		const lightIndexMap = new Map<Light, number>();

		for (const property of this.properties) {
			const light = property as Light;
			const lightDef = {type: light.getType()} as LightDef;

			if (!MathUtils.eq(light.getColor(), [1, 1, 1])) lightDef.color = light.getColor();
			if (light.getIntensity() !== 1) lightDef.intensity = light.getIntensity();
			if (light.getRange() != null) lightDef.range = light.getRange()!;

			if (light.getName()) lightDef['name'] = light.getName();

			if (light.getType() === Light.Type.SPOT) {
				lightDef['innerConeAngle'] = light.getInnerConeAngle();
				lightDef['outerConeAngle'] = light.getOuterConeAngle();
			}

			lightDefs.push(lightDef);
			lightIndexMap.set(light, lightDefs.length - 1);
		}

		this.doc.getRoot()
			.listNodes()
			.forEach((node) => {
				const light = node.getExtension<Light>(NAME);
				if (light) {
					const nodeIndex = context.nodeIndexMap.get(node)!;
					const nodeDef = jsonDoc.json.nodes![nodeIndex];
					nodeDef.extensions = nodeDef.extensions || {};
					nodeDef.extensions[NAME] = {light: lightIndexMap.get(light)};
				}
			});

		jsonDoc.json.extensions = jsonDoc.json.extensions || {};
		jsonDoc.json.extensions[NAME] = {lights: lightDefs};

		return this;
	}
}
