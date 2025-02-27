import { LitElement, html } from 'lit';
import { property, customElement } from 'lit/decorators.js';
import { HomeAssistant, navigate } from 'custom-card-helpers';

import { prettyPrint, handleError, sortAlphabetically, pick } from '../../helpers';
import { AlarmoConfig, Dictionary, AlarmoUser } from '../../types';

import './user-editor-card.ts';
import '../../components/settings-row.ts';
import '../../components/alarmo-table.ts';

import { commonStyle } from '../../styles';
import { localize } from '../../../localize/localize';
import { SubscribeMixin } from '../../subscribe-mixin';
import { UnsubscribeFunc } from 'home-assistant-js-websocket';
import { fetchConfig, fetchUsers, saveConfig, saveUser } from '../../data/websockets';
import { TableData, TableColumn } from '../../components/alarmo-table';

@customElement('alarm-view-codes')
export class AlarmViewCodes extends SubscribeMixin(LitElement) {

  @property()
  hass?: HomeAssistant;

  @property()
  narrow!: boolean;

  @property()
  path!: string[] | null;

  @property()
  data?: Partial<AlarmoConfig>;

  @property()
  users: Dictionary<AlarmoUser> = {};

  public hassSubscribe(): Promise<UnsubscribeFunc>[] {
    this._fetchData();
    return [this.hass!.connection.subscribeMessage(() => this._fetchData(), { type: 'alarmo_config_updated' })];
  }

  private async _fetchData(): Promise<void> {
    if (!this.hass) {
      return;
    }
    const config = await fetchConfig(this.hass);
    this.data = pick(config, ['code_arm_required', 'code_disarm_required', 'code_format']);

    const users = await fetchUsers(this.hass);
    this.users = users;
  }

  render() {
    if (!this.hass || !this.data) return html``;

    if (this.path && this.path[0] == 'new_user') {
      return html`
        <user-editor-card .hass=${this.hass} .narrow=${this.narrow}> </user-editor-card>
      `;
    } else if (this.path && this.path.length == 2 && this.path[0] == 'edit_user') {
      return html`
        <user-editor-card .hass=${this.hass} .narrow=${this.narrow} item=${this.path[1]}> </user-editor-card>
      `;
    } else {
      return html`
        <ha-card header="${localize('panels.codes.title', this.hass.language)}">
          <div class="card-content">${localize('panels.codes.cards.codes.description', this.hass.language)}</div>

          <settings-row .narrow=${this.narrow}>
            <span slot="heading">${localize('panels.codes.cards.codes.fields.code_arm_required.heading', this.hass.language)}</span>
            <span slot="description">${localize('panels.codes.cards.codes.fields.code_arm_required.description', this.hass.language)}</span>
            <ha-switch
              ?checked=${this.data.code_arm_required}
              @change=${(ev: Event) => { this.saveData({ code_arm_required: (ev.target as HTMLInputElement).checked }) }}
            >
            </ha-switch>
          </settings-row>

          <settings-row .narrow=${this.narrow}>
            <span slot="heading">${localize('panels.codes.cards.codes.fields.code_disarm_required.heading', this.hass.language)}</span>
            <span slot="description">${localize('panels.codes.cards.codes.fields.code_disarm_required.description', this.hass.language)}</span>
            <ha-switch
              ?checked=${this.data.code_disarm_required}
              @change=${(ev: Event) => { this.saveData({ code_disarm_required: (ev.target as HTMLInputElement).checked }) }}
            >
            </ha-switch>
          </settings-row>

          <settings-row .narrow=${this.narrow}>
            <span slot="heading">${localize('panels.codes.cards.codes.fields.code_format.heading', this.hass.language)}</span>
            <span slot="description">${localize('panels.codes.cards.codes.fields.code_format.description', this.hass.language)}</span>
            <mwc-button
              class="${this.data.code_format == 'number' ? 'active' : ''} ${!this.data.code_arm_required && !this.data.code_disarm_required ? 'disabled' : ''}"
              @click=${() => { this.saveData({ code_format: 'number' }) }}
              ?disabled=${!this.data.code_arm_required && !this.data.code_disarm_required}
            >
              ${localize('panels.codes.cards.codes.fields.code_format.code_format_number', this.hass.language)}
            </mwc-button>
            <mwc-button
              class="${this.data.code_format == 'text' ? 'active' : ''} ${!this.data.code_arm_required && !this.data.code_disarm_required ? 'disabled' : ''}"
              @click=${() => { this.saveData({ code_format: 'text' }) }}
              ?disabled=${!this.data.code_arm_required && !this.data.code_disarm_required}
            >
              ${localize('panels.codes.cards.codes.fields.code_format.code_format_text', this.hass.language)}
            </mwc-button>
          </settings-row>
        </ha-card>

        ${this.usersPanel()}
      `;
    }
  }

  usersPanel() {
    if (!this.hass) return html``;

    const users = Object.values(this.users);
    users.sort(sortAlphabetically);

    const columns: Dictionary<TableColumn> = {
      icon: {
        width: '40px',
      },
      name: {
        title: this.hass.localize('ui.components.area-picker.add_dialog.name'),
        width: '40%',
        grow: true,
        text: true,
      },
      code_format: {
        title: localize('panels.codes.cards.codes.fields.code_format.heading', this.hass.language),
        width: '40%',
        hide: this.narrow,
        text: true,
      },
      enabled: {
        title: localize('panels.actions.cards.notifications.table.enabled', this.hass.language),
        width: '68px',
        align: 'center',
      }
    };

    const data = users.map(item => {
      const output: TableData = {
        id: item.user_id!,
        icon: html`
          <ha-icon icon="mdi:account-outline"></ha-icon>
        `,
        name: prettyPrint(item.name),
        code_format: item.code_format == 'number'
          ? prettyPrint(localize('panels.codes.cards.codes.fields.code_format.code_format_number', this.hass!.language))
          : item.code_format == 'text'
            ? prettyPrint(localize('panels.codes.cards.codes.fields.code_format.code_format_text', this.hass!.language))
            : this.hass!.localize('state.default.unknown'),
        enabled: html`
          <ha-switch
            @click=${(ev: Event) => { ev.stopPropagation() }}
            ?checked=${item.enabled}
            @change=${(ev: Event) => this.toggleEnabled(ev, item.user_id!)}
          >
          </ha-switch>
        `,
      };
      return output;
    });

    return html`
      <ha-card header="${localize('panels.codes.cards.user_management.title', this.hass.language)}">
        <div class="card-content">
          ${localize('panels.codes.cards.user_management.description', this.hass.language)}
        </div>

        <alarmo-table
          ?selectable=${true}
          .columns=${columns}
          .data=${data}
          @row-click=${(ev: CustomEvent) => {
        const id = String(ev.detail.id);
        navigate(this, `/alarmo/codes/edit_user/${id}`, true);
      }}
        >
          ${localize('panels.codes.cards.user_management.no_items', this.hass.language)}
        </alarmo-table>
        <div class="card-actions">
          <mwc-button @click=${this.addUserClick}>
            ${localize('panels.codes.cards.user_management.actions.new_user', this.hass.language)}
          </mwc-button>
        </div>
      </ha-card>
    `;
  }

  addUserClick() {
    navigate(this, '/alarmo/codes/new_user', true);
  }

  saveData(changes: Partial<AlarmoConfig>) {
    if (!this.hass) return;

    this.data = {
      ...this.data,
      ...changes
    }

    saveConfig(this.hass, this.data)
      .catch(e => handleError(e, this.shadowRoot!.querySelector("ha-card") as HTMLElement))
      .then();
  }

  toggleEnabled(ev: Event, id: string) {
    const enabled = (ev.target as HTMLInputElement).checked;
    saveUser(this.hass!, { user_id: id, enabled: enabled })
      .catch(e => handleError(e, ev))
      .then();
  }

  static styles = commonStyle;
}
