import { useLayoutEffect, useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import moment, { type Moment } from 'moment';
import { Button, DatePicker, Dropdown, Input, List, Modal, Pagination } from 'tea-component';
import { type MemoryLayer, type MemoryBlock, type AtomicItem } from './types';
import { useLayers } from './constants';
import { getLayerCount, stripAtMention, extractRole, formatDisplayTime } from './utils';
import { stripScenarioMeta, copyToClipboard } from './memory-utils';
import { useUserDisplayName } from '@/services/user-profile-store';
import { tea } from '@/lib/tea-bridge';
import { MarkdownView } from '@/components/MarkdownView';
import type { ChatMemorySearchHit } from '@/lib/teamApi';
import {
  AppIcon,
  UsergroupIcon,
  ChevronDownIcon,
  InfoCircleIcon,
  TimeIcon,
  SearchIcon,
  MoreIcon,
} from 'tea-icons-react';

const { RangePicker } = DatePicker;

/** L0 角色 → 展示分组：user 右侧、system 通栏、其余（assistant/tool/...）左侧。 */
type L0Tone = 'user' | 'assistant' | 'system' | 'tool';
function toneOfRole(role: string): L0Tone {
  if (role === 'user') return 'user';
  if (role === 'system') return 'system';
  if (role === 'tool') return 'tool';
  return 'assistant';
}

/** 单条原子记忆的标题行：层级徽章 + 标题 + 时间 + 操作菜单（三点）+ 可选 chevron。
 *  L1 / L2 / L3 共用。L2 通过 expandable=true 额外渲染 chevron 并把整行做成可点击展开区。
 *  head 始终展示真实内容（不因加载态变骨架），加载正文时只有下方正文区显示骨架。 */
function AtomicHead({
  layer,
  tone,
  item,
  time,
  canEditItem,
  canCopyItem,
  onEdit,
  onCopy,
  expandable,
  expanded,
  loading,
  onToggle,
}: {
  layer: MemoryLayer;
  tone: string;
  item: AtomicItem;
  time: string;
  canEditItem: boolean;
  canCopyItem: boolean;
  onEdit?: (item: AtomicItem) => void;
  onCopy: () => void;
  /** L2 为 true：渲染 chevron 展开箭头、整行可点击展开/折叠 */
  expandable: boolean;
  /** 是否已展开（L2：hasBody） */
  expanded: boolean;
  loading: boolean;
  onToggle?: () => void;
}) {
  const { t } = useTranslation();
  const hasActions = canEditItem || canCopyItem;
  const withBody = expandable ? expanded || loading : true;

  const inner = (
    <>
      <span className={`_memory-detail-atomic-layer _memory-detail-atomic-layer--${tone}`}>
        {layer}
      </span>
      <span className="_memory-detail-atomic-title" title={item.title}>
        {item.title}
      </span>
      <span className="_memory-detail-atomic-head-right">
        {time && (
          <span className="_memory-detail-atomic-time" title={item.created_at}>
            {time}
          </span>
        )}
        {/* 操作菜单（三个点）置于时间右侧。三个点点击展开，支持编辑 / 复制。
            L2 的 head 是可点击展开区域，需阻止冒泡避免误触发折叠。 */}
        {hasActions && (
          <span
            className="_memory-detail-atomic-actions"
            onClick={(e) => e.stopPropagation()}
          >
            <Dropdown
              appearance="pure"
              clickClose
              placement="bottom-end"
              button={
                <Button
                  type="text"
                  className="_memory-detail-atomic-more"
                  tooltip={t('memory.detail.moreActions')}
                >
                  <MoreIcon />
                </Button>
              }
            >
              <List type="option">
                {canEditItem && (
                  <List.Item onClick={() => onEdit!(item)}>
                    {t('memory.detail.edit')}
                  </List.Item>
                )}
                {canCopyItem && (
                  <List.Item onClick={() => void onCopy()}>
                    {t('common.copy')}
                  </List.Item>
                )}
              </List>
            </Dropdown>
          </span>
        )}
        {expandable && (
          <span className="_memory-detail-atomic-chevron-btn" aria-hidden={loading}>
            {loading ? (
              /* 展开加载中：chevron 位置显示 spinner，表示正在下载正文 */
              <span className="_memory-chat-more-spinner _memory-detail-atomic-spinner" />
            ) : (
/* __GAP__ line 126 */
/* __GAP__ line 127 */
/* __GAP__ line 128 */
/* __GAP__ line 129 */
/* __GAP__ line 130 */
/* __GAP__ line 131 */
/* __GAP__ line 132 */
/* __GAP__ line 133 */
/* __GAP__ line 134 */
/* __GAP__ line 135 */
/* __GAP__ line 136 */
/* __GAP__ line 137 */
/* __GAP__ line 138 */
/* __GAP__ line 139 */
/* __GAP__ line 140 */
/* __GAP__ line 141 */
/* __GAP__ line 142 */
/* __GAP__ line 143 */
/* __GAP__ line 144 */
/* __GAP__ line 145 */
/* __GAP__ line 146 */
/* __GAP__ line 147 */
/* __GAP__ line 148 */
/* __GAP__ line 149 */
/* __GAP__ line 150 */
/* __GAP__ line 151 */
/* __GAP__ line 152 */
/* __GAP__ line 153 */
/* __GAP__ line 154 */
/* __GAP__ line 155 */
/* __GAP__ line 156 */
/* __GAP__ line 157 */
/* __GAP__ line 158 */
/* __GAP__ line 159 */
/* __GAP__ line 160 */
/* __GAP__ line 161 */
/* __GAP__ line 162 */
/* __GAP__ line 163 */
/* __GAP__ line 164 */
/* __GAP__ line 165 */
/* __GAP__ line 166 */
/* __GAP__ line 167 */
/* __GAP__ line 168 */
/* __GAP__ line 169 */
/* __GAP__ line 170 */
/* __GAP__ line 171 */
/* __GAP__ line 172 */
/* __GAP__ line 173 */
/* __GAP__ line 174 */
/* __GAP__ line 175 */
/* __GAP__ line 176 */
/* __GAP__ line 177 */
/* __GAP__ line 178 */
/* __GAP__ line 179 */
/* __GAP__ line 180 */
/* __GAP__ line 181 */
/* __GAP__ line 182 */
/* __GAP__ line 183 */
/* __GAP__ line 184 */
/* __GAP__ line 185 */
/* __GAP__ line 186 */
/* __GAP__ line 187 */
/* __GAP__ line 188 */
/* __GAP__ line 189 */

/** L1 / L3 原子记忆列表：正文直接展示（无折叠展开）。 */
function AtomicList({
  layer,
  items,
  loadingItemId,
  timeFiltered,
  canEdit,
  onEdit,
}: {
  layer: MemoryLayer;
  items: AtomicItem[];
  loadingItemId?: string | null;
  /** 当前层是否受时间筛选影响（仅 L1）：影响空态文案的语境 */
  timeFiltered?: boolean;
  /** 是否显示每条的编辑入口（仅资产 Owner） */
  canEdit?: boolean;
  /** 点击编辑单条 */
  onEdit?: (item: AtomicItem) => void;
}) {
  const { t } = useTranslation();
  const LAYERS = useLayers();
  const meta = LAYERS.find((l) => l.id === layer)!;
  if (items.length === 0) {
    return (
      <div className="_memory-detail-empty">
        {timeFiltered
          ? t('memory.detail.emptyLayerInRange', { layer: meta.short })
          : t('memory.detail.emptyLayer', { layer: meta.short })}
      </div>
    );
  }
  return (
    <ul className="_memory-detail-atomic-list">
      {items.map((it) => {
        const hasBody = it.body.trim().length > 0;
        const loading = loadingItemId === it.id;
        const time = formatDisplayTime(it.created_at);
        const canEditItem = !!(canEdit && onEdit);
        const canCopyItem = true;
        async function handleCopy() {
          const ok = await copyToClipboard(it.body);
          if (ok) {
            tea.notify.success(t('memory.notify.copied'));
          } else {
            tea.notify.error(t('memory.notify.copyFailed'));
          }
        }
        return (
          <li key={it.id} className="_memory-detail-atomic-item">
            <AtomicHead
              layer={layer}
              tone={meta.tone}
              item={it}
              time={time}
              canEditItem={canEditItem}
              canCopyItem={canCopyItem}
              onEdit={onEdit}
              onCopy={() => void handleCopy()}
              expandable={false}
              expanded={false}
              loading={loading}
            />
            {layer === 'L3' ? (
              hasBody ? (
                <MarkdownView bare className="_memory-detail-atomic-md">
                  {it.body}
                </MarkdownView>
              ) : loading ? (
                <div className="_memory-detail-atomic-body-skel" aria-busy="true">
                  <div className="_memory-detail-atomic-body-skel-line" style={{ width: '88%' }} />
                  <div className="_memory-detail-atomic-body-skel-line" style={{ width: '70%' }} />
                </div>
              ) : (
                <div className="_memory-detail-atomic-no-body">{t('memory.detail.noBody')}</div>
