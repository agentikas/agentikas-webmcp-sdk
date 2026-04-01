// @agentikas/webmcp-sdk — Type-level tests (compile-time only)

import { describe, it, expectTypeOf, assertType } from 'vitest';
import type {
  AgentikasConfig,
  ToolDefinition,
  ToolFactory,
  ToolResult,
  Executor,
  ExecutorFactory,
  ExecutorMap,
  VerticalDefinition,
  PlatformAdapter,
} from '../src/types';
import type {
  RestaurantInfo,
  MenuItem,
  RestaurantData,
} from '../src/verticals/restaurant/types';
import {
  buildTools,
  registerVertical,
  getExecutors,
  initAgentikas,
  detectPlatform,
} from '../src/index';

// ── AgentikasConfig ───────────────────────────────────────────

describe('AgentikasConfig type', () => {
  it('requires businessId as a string', () => {
    expectTypeOf<AgentikasConfig>().toHaveProperty('businessId');
    expectTypeOf<AgentikasConfig['businessId']>().toBeString();
  });

  it('requires vertical as a string', () => {
    expectTypeOf<AgentikasConfig>().toHaveProperty('vertical');
    expectTypeOf<AgentikasConfig['vertical']>().toBeString();
  });

  it('platform is optional string', () => {
    expectTypeOf<AgentikasConfig>().toHaveProperty('platform');
    expectTypeOf<AgentikasConfig['platform']>().toEqualTypeOf<string | undefined>();
  });

  it('tools is optional string array', () => {
    expectTypeOf<AgentikasConfig>().toHaveProperty('tools');
    expectTypeOf<AgentikasConfig['tools']>().toEqualTypeOf<string[] | undefined>();
  });

  it('debug is optional boolean', () => {
    expectTypeOf<AgentikasConfig>().toHaveProperty('debug');
    expectTypeOf<AgentikasConfig['debug']>().toEqualTypeOf<boolean | undefined>();
  });

  it('config without businessId should not be assignable', () => {
    type WithoutBusinessId = Omit<AgentikasConfig, 'businessId'>;
    expectTypeOf<WithoutBusinessId>().not.toMatchTypeOf<AgentikasConfig>();
  });
});

// ── ToolDefinition ────────────────────────────────────────────

describe('ToolDefinition type', () => {
  it('has name: string, description: string, and input_schema', () => {
    expectTypeOf<ToolDefinition>().toHaveProperty('name');
    expectTypeOf<ToolDefinition['name']>().toBeString();

    expectTypeOf<ToolDefinition>().toHaveProperty('description');
    expectTypeOf<ToolDefinition['description']>().toBeString();

    expectTypeOf<ToolDefinition>().toHaveProperty('input_schema');
  });

  it('input_schema.type is always "object"', () => {
    expectTypeOf<ToolDefinition['input_schema']['type']>().toEqualTypeOf<'object'>();
  });

  it('input_schema.properties values have type and description', () => {
    type PropValue = ToolDefinition['input_schema']['properties'][string];
    expectTypeOf<PropValue>().toHaveProperty('type');
    expectTypeOf<PropValue>().toHaveProperty('description');
    expectTypeOf<PropValue['description']>().toBeString();
  });
});

// ── ToolFactory ───────────────────────────────────────────────

describe('ToolFactory type', () => {
  it('takes data and returns ToolDefinition', () => {
    expectTypeOf<ToolFactory>().toBeFunction();
    expectTypeOf<ToolFactory>().returns.toEqualTypeOf<ToolDefinition>();
  });

  it('ToolFactory<RestaurantData> accepts RestaurantData', () => {
    expectTypeOf<ToolFactory<RestaurantData>>().toBeFunction();
    expectTypeOf<ToolFactory<RestaurantData>>().parameter(0).toEqualTypeOf<RestaurantData>();
    expectTypeOf<ToolFactory<RestaurantData>>().returns.toEqualTypeOf<ToolDefinition>();
  });
});

// ── Executor & ToolResult ─────────────────────────────────────

describe('Executor type', () => {
  it('takes any args and returns ToolResult or Promise<ToolResult>', () => {
    expectTypeOf<Executor>().toBeFunction();
    expectTypeOf<Executor>().parameter(0).toBeAny();
    expectTypeOf<Executor>().returns.toEqualTypeOf<ToolResult | Promise<ToolResult>>();
  });

  it('ToolResult has content array with type and text', () => {
    expectTypeOf<ToolResult>().toHaveProperty('content');
    expectTypeOf<ToolResult['content']>().toBeArray();

    type ContentItem = ToolResult['content'][number];
    expectTypeOf<ContentItem>().toHaveProperty('type');
    expectTypeOf<ContentItem['type']>().toEqualTypeOf<'text'>();
    expectTypeOf<ContentItem>().toHaveProperty('text');
    expectTypeOf<ContentItem['text']>().toBeString();
  });
});

// ── ExecutorFactory & ExecutorMap ──────────────────────────────

describe('ExecutorFactory type', () => {
  it('takes data and returns Executor', () => {
    expectTypeOf<ExecutorFactory>().toBeFunction();
    expectTypeOf<ExecutorFactory>().returns.toEqualTypeOf<Executor>();
  });

  it('ExecutorMap is Record<string, ExecutorFactory>', () => {
    expectTypeOf<ExecutorMap>().toEqualTypeOf<Record<string, ExecutorFactory>>();
  });
});

// ── VerticalDefinition ────────────────────────────────────────

describe('VerticalDefinition type', () => {
  it('has id, name, tools (Record<string, ToolFactory>), defaultTools (string[])', () => {
    expectTypeOf<VerticalDefinition>().toHaveProperty('id');
    expectTypeOf<VerticalDefinition['id']>().toBeString();

    expectTypeOf<VerticalDefinition>().toHaveProperty('name');
    expectTypeOf<VerticalDefinition['name']>().toBeString();

    expectTypeOf<VerticalDefinition>().toHaveProperty('tools');
    expectTypeOf<VerticalDefinition['tools']>().toEqualTypeOf<Record<string, ToolFactory>>();

    expectTypeOf<VerticalDefinition>().toHaveProperty('defaultTools');
    expectTypeOf<VerticalDefinition['defaultTools']>().toEqualTypeOf<string[]>();
  });
});

// ── PlatformAdapter ───────────────────────────────────────────

describe('PlatformAdapter type', () => {
  it('has id, name, executors (ExecutorMap)', () => {
    expectTypeOf<PlatformAdapter>().toHaveProperty('id');
    expectTypeOf<PlatformAdapter['id']>().toBeString();

    expectTypeOf<PlatformAdapter>().toHaveProperty('name');
    expectTypeOf<PlatformAdapter['name']>().toBeString();

    expectTypeOf<PlatformAdapter>().toHaveProperty('executors');
    expectTypeOf<PlatformAdapter['executors']>().toEqualTypeOf<ExecutorMap>();
  });

  it('detect is optional function returning boolean', () => {
    expectTypeOf<PlatformAdapter>().toHaveProperty('detect');
    expectTypeOf<PlatformAdapter['detect']>().toEqualTypeOf<(() => boolean) | undefined>();
  });
});

// ── Function signatures ───────────────────────────────────────

describe('Function signatures', () => {
  it('buildTools returns ToolDefinition[]', () => {
    expectTypeOf(buildTools).toBeFunction();
    expectTypeOf(buildTools).parameter(0).toEqualTypeOf<AgentikasConfig>();
    expectTypeOf(buildTools).returns.toEqualTypeOf<ToolDefinition[]>();
  });

  it('registerVertical accepts VerticalDefinition + ExecutorMap', () => {
    expectTypeOf(registerVertical).toBeFunction();
    expectTypeOf(registerVertical).parameter(0).toEqualTypeOf<VerticalDefinition>();
    expectTypeOf(registerVertical).parameter(1).toEqualTypeOf<ExecutorMap>();
    expectTypeOf(registerVertical).returns.toBeVoid();
  });

  it('getExecutors returns ExecutorMap | undefined', () => {
    expectTypeOf(getExecutors).toBeFunction();
    expectTypeOf(getExecutors).returns.toEqualTypeOf<ExecutorMap | undefined>();
  });

  it('initAgentikas returns void', () => {
    expectTypeOf(initAgentikas).toBeFunction();
    expectTypeOf(initAgentikas).returns.toBeVoid();
  });

  it('detectPlatform returns string', () => {
    expectTypeOf(detectPlatform).toBeFunction();
    expectTypeOf(detectPlatform).returns.toBeString();
  });
});

// ── Restaurant types ──────────────────────────────────────────

describe('RestaurantInfo type', () => {
  it('has required fields: id, name, description, address, contact', () => {
    expectTypeOf<RestaurantInfo>().toHaveProperty('id');
    expectTypeOf<RestaurantInfo['id']>().toBeString();

    expectTypeOf<RestaurantInfo>().toHaveProperty('name');
    expectTypeOf<RestaurantInfo['name']>().toBeString();

    expectTypeOf<RestaurantInfo>().toHaveProperty('description');
    expectTypeOf<RestaurantInfo['description']>().toBeString();

    expectTypeOf<RestaurantInfo>().toHaveProperty('address');
    expectTypeOf<RestaurantInfo['address']>().toHaveProperty('streetAddress');
    expectTypeOf<RestaurantInfo['address']>().toHaveProperty('locality');
    expectTypeOf<RestaurantInfo['address']>().toHaveProperty('postalCode');
    expectTypeOf<RestaurantInfo['address']>().toHaveProperty('country');

    expectTypeOf<RestaurantInfo>().toHaveProperty('contact');
    expectTypeOf<RestaurantInfo['contact']>().toHaveProperty('phone');
    expectTypeOf<RestaurantInfo['contact']>().toHaveProperty('website');
  });
});

describe('MenuItem type', () => {
  it('has required fields: id, name, price, allergens', () => {
    expectTypeOf<MenuItem>().toHaveProperty('id');
    expectTypeOf<MenuItem['id']>().toBeString();

    expectTypeOf<MenuItem>().toHaveProperty('name');
    expectTypeOf<MenuItem['name']>().toBeString();

    expectTypeOf<MenuItem>().toHaveProperty('price');
    expectTypeOf<MenuItem['price']>().toBeNumber();

    expectTypeOf<MenuItem>().toHaveProperty('allergens');
    expectTypeOf<MenuItem['allergens']>().toBeArray();
  });
});

describe('RestaurantData type', () => {
  it('has restaurant and allItems', () => {
    expectTypeOf<RestaurantData>().toHaveProperty('restaurant');
    expectTypeOf<RestaurantData['restaurant']>().toEqualTypeOf<RestaurantInfo>();

    expectTypeOf<RestaurantData>().toHaveProperty('allItems');
    expectTypeOf<RestaurantData['allItems']>().toEqualTypeOf<MenuItem[]>();
  });
});
