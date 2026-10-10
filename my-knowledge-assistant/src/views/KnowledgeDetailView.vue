<template>
  <div class="detail-view">
    <!-- 加载中 -->
    <div v-if="loading" class="loading-state">加载中...</div>

    <!-- 条目不存在 -->
    <div v-else-if="!item" class="empty-state">
      <p>知识库不存在</p>
      <button @click="goBack">返回知识库</button>
    </div>

    <!-- 主内容 -->
    <div v-else class="detail-content">
      <!-- ===== 头部信息（只读，编辑挪到「笔记」tab） ===== -->
      <div class="detail-header">
        <div class="header-top">
          <button class="back-btn" @click="goBack">← 返回知识库</button>
          <!-- chats: 编辑入口从「知识」tab 挪到页头。原来它改的是标题 / 状态 / 描述，
               而这三位显示在页头——控件在下面、被改的内容在上面，中间隔着一个 tab，
               改的时候还得抬头看页头有没有变。现在就地编辑：点「编辑」，页头原地变成控件。 -->
          <div class="header-actions">
            <template v-if="!isEditing">
              <button class="btn-outline" @click="startEdit">编辑</button>
            </template>
            <template v-else>
              <button class="btn-outline btn-solid" :disabled="!editTitle.trim()" @click="saveEdit">
                保存
              </button>
              <button class="btn-outline" @click="cancelEdit">取消</button>
            </template>
          </div>
        </div>
        <!-- chats: 快捷卡已挪进概览 tab，页头回归纯标题/状态/描述 -->
        <div class="header-main">
          <h1 v-if="!isEditing" class="detail-title">{{ item.title }}</h1>
          <input
            v-else
            v-model="editTitle"
            class="detail-title inline-field"
            placeholder="标题"
            @keyup.enter="saveEdit"
          />
          <div class="detail-meta">
            <span v-if="!isEditing" class="level-badge" :class="item.level">{{ item.level }}</span>
            <!-- chats: 原来这里是个原生 <select>，和常态的「圆点 + 灰字」完全两个样。
                 改成同一套写法的三个选项，选中的那个加深加底，看起来还是「那个状态徽章」。 -->
            <div v-else class="level-picker">
              <button
                v-for="lv in levelOptions"
                :key="lv"
                class="level-badge level-opt"
                :class="[lv, { active: editLevel === lv }]"
                @click="editLevel = lv"
              >
                {{ lv }}
              </button>
            </div>
            <span class="detail-date">创建于 {{ formatDate(item.createdAt) }}</span>
          </div>
          <p v-if="!isEditing && item.description" class="detail-desc">
            {{ item.description }}
          </p>
          <!-- chats: 编辑态的描述输入框必须和上面的 v-if 描述段落相邻，v-else-if 才能成立 -->
          <textarea
            v-else-if="isEditing"
            v-model="editDesc"
            class="detail-desc inline-field"
            rows="2"
            placeholder="一句话描述（可选）"
          ></textarea>
        </div>
      </div>

      <!-- chats: 轻量看图器——概览附件卡点缩略图弹出，参照 viewerjs 交互自研 -->
      <Lightbox
        :src="lightboxSrc"
        :images="lightboxImages"
        @close="lightboxSrc = ''"
        @nav="onLightboxNav"
      />

      <!-- chats: 笔记右键菜单——Teleport 到 body，全屏透明遮罩负责「点外面关闭」，
           菜单本体用 clientX/Y 定位（贴边 clamp 防止弹出视口） -->
      <Teleport to="body">
        <div
          v-if="noteMenu.visible"
          class="ctx-mask"
          @click.self="closeNoteMenu"
          @contextmenu.prevent="closeNoteMenu"
        >
          <div class="ctx-menu" :style="{ left: noteMenu.x + 'px', top: noteMenu.y + 'px' }">
            <button class="ctx-item" @click="noteMenuAction('edit')">修改笔记</button>
            <button class="ctx-item" @click="noteMenuAction('share')">分享笔记</button>
            <button class="ctx-item" @click="noteMenuAction('download')">下载笔记（.md）</button>
          </div>
        </div>
      </Teleport>

      <!-- ===== 导航栏（chats: 四 tab 重构为 概览 | 笔记 | 关系 | 资料） ===== -->
      <div class="tab-nav">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="tab-btn"
          :class="{ active: activeTab === tab.key }"
          @click="onTabClick(tab)"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- ===== Tab 内容面板 ===== -->
      <div class="tab-content">
        <!-- chat: 概览只保留学习摘要和下一步入口；标题、状态、简介已在导航上方展示，不再重复。 -->
        <div v-show="activeTab === 'overview'" class="tab-panel">
          <div class="overview-layout">
            <!-- chats: 笔记/附件两张卡从页头挪进概览——概览本来就是「一眼看全」的 tab，
                 卡片放这里比挤在页头更合理。原「知识笔记」标题区、「查看全部」、「N 份资料」
                 统计卡一并删除：卡片自身已带字数/个数和跳转，不再重复。 -->
            <div class="overview-cards">
              <div class="header-card" @click="activeTab = 'knowledge'">
                <div class="hc-head">
                  <span class="hc-label">笔记</span>
                  <span class="hc-count">{{ item.notes?.length || 0 }} 篇</span>
                </div>
                <div
                  v-if="item.notes?.length"
                  class="hc-scroll hc-atts"
                  @wheel.prevent="onCardWheel"
                >
                  <!-- chats: 笔记一对多——横滚区每篇一个标题 chip，尺寸对齐附件缩略图（44px 见方），
                       两张卡内容行等高；样式复用附件的 .hc-att 只保留配色，尺寸单独走 .hc-note-chip -->
                  <span v-for="n in item.notes" :key="n.id" class="hc-note-chip">{{
                    n.title
                  }}</span>
                </div>
                <div v-else class="hc-scroll hc-empty">暂无笔记，去「笔记」tab 记录</div>
              </div>
              <div class="header-card" @click="activeTab = 'materials'">
                <div class="hc-head">
                  <span class="hc-label">附件</span>
                  <span class="hc-count">{{ item.attachments?.length || 0 }} 个</span>
                </div>
                <div
                  v-if="item.attachments?.length"
                  class="hc-scroll hc-atts"
                  @wheel.prevent="onCardWheel"
                >
                  <!-- chats: 图片附件直接出缩略图（点击开灯箱放大），非图片保持文件名 chip。
                       缩略图 stop 冒泡，避免触发卡片本身的「跳资料 tab」 -->
                  <template v-for="a in item.attachments" :key="a.id">
                    <img
                      v-if="isImageAttachment(a)"
                      class="hc-thumb"
                      :src="previewUrls[a.id] || a.data || ''"
                      :title="a.name"
                      @click.stop="openLightbox(a)"
                    />
                    <span v-else class="hc-att">{{ a.name }}</span>
                  </template>
                </div>
                <div v-else class="hc-scroll hc-empty">暂无附件</div>
              </div>
            </div>

            <!-- chats: 思维导图放在概览——它是这条知识的结构总览（学了什么、分几块），
                 和笔记摘要同属「看一眼就懂全局」的信息；「知识」tab 因此回归纯笔记业务。
                 生成按钮仍在标题右侧，与其它 tab 的页头动作位置一致。 -->
            <section class="kb-section">
              <div class="kb-section-head">
                <h3 class="kb-title">思维导图</h3>
                <button
                  class="btn-outline kb-head-action"
                  @click="handleGenerateMindmap"
                  :disabled="isGenerating"
                >
                  {{
                    isGenerating ? '生成中...' : item.mindmapData ? '更新思维导图' : '生成思维导图'
                  }}
                </button>
              </div>
              <div class="mindmap-panel">
                <div v-if="item.mindmapData" class="mindmap-container">
                  <!-- chat: 导图容器由 MindMap 组件按实际内容尺寸撑开，完整显示不裁切 -->
                  <MindMap :data="item.mindmapData" />
                </div>
                <div v-else class="empty-mindmap">
                  <p>暂无思维导图，点上方「生成思维导图」创建</p>
                </div>
              </div>
            </section>

            <!-- chats: 概览不再放「知识关联」快捷区块（前置/相关知识 chips + 管理关联）——
                 关系的管理和查看都收拢在「关系」tab，概览只留笔记摘要 / 统计 / 思维导图 -->
          </div>
        </div>

        <!-- chats: 知识 tab = 横向笔记条 + 下方阅读区（笔记一对多，Note[] 真数据）。
             点导航「笔记」进入本 tab 时笔记条自动放出；在 tab 上再点一次收起/放出。
             点条目 = 下方阅读区显示这篇内容（再点一次收起），右键是快捷菜单；
             编辑/新建走弹窗，阅读就在条内，不弹窗 -->
        <div v-show="activeTab === 'knowledge'" class="tab-panel notes-panel">
          <!-- chats: 横向笔记条——顶边贴住 tab 导航下边框，条目横排、可横向滚动（滚轮直滚）。
               没有笔记也渲染：否则空条目上点「笔记」横条整个消失，
               收放交互看起来像「没反应」（2026-10-10 用户实测踩中）。
               点条目 = 下方阅读区显示这篇内容；右键 = 快捷菜单 -->
          <div v-if="isNotesBarOpen" class="note-bar" @wheel.prevent="onCardWheel">
            <button
              v-for="n in noteEntries"
              :key="n.id"
              class="bar-item"
              :class="{ active: n.id === viewingNoteId }"
              @click="openNote(n.id)"
              @contextmenu.prevent="openNoteMenu($event, n)"
            >
              <span class="bi-title">{{ n.title }}</span>
            </button>
            <!-- chats: 新建入口常驻（有笔记也要能加第二篇），弹窗收集标题/日期/正文 -->
            <button class="bar-add" @click="openCreateNote">＋ 新建笔记</button>
          </div>
          <!-- chats: 阅读区——点笔记条目在下方展开内容（2026-10-10 用户本意：
               openNote 是「打开看」，不是弹窗）。标题/日期一行头 + 正文 pre-wrap；
               编辑按钮进弹窗表单。无选中不渲染，不占地方 -->
          <div v-if="viewingNote" class="note-reader">
            <div class="nr-head">
              <div class="nr-meta">
                <span class="nr-title">{{ viewingNote.title }}</span>
                <span class="nr-date">{{ viewingNote.date }}</span>
              </div>
              <div class="nr-actions">
                <button class="btn-outline" @click="viewingNoteId = null">关闭</button>
                <button class="btn-outline btn-solid" @click="openNoteEditor(viewingNote.id)">
                  编辑
                </button>
              </div>
            </div>
            <div v-if="viewingNote.content" class="nr-content">{{ viewingNote.content }}</div>
            <div v-else class="nr-content nr-placeholder">（这篇笔记还没有正文）</div>
          </div>
        </div>

        <!-- chats: 新建/修改笔记共用一个弹窗——项目统一外壳 BaseModal，
             新建时只填标题/日期/正文，修改时表单回填、多一个「删除」按钮。
             阅读不放弹窗——点条目在笔记条下方展示（2026-10-10 用户定稿） -->
        <BaseModal v-if="noteModalOpen" @close="noteModalOpen = false">
          <h3>{{ editingNoteId ? '修改笔记' : '新建笔记' }}</h3>
          <div class="note-form">
            <label class="nf-field">
              <span class="nf-label">标题</span>
              <input v-model="noteForm.title" type="text" placeholder="笔记标题" />
            </label>
            <label class="nf-field">
              <span class="nf-label">日期</span>
              <input v-model="noteForm.date" type="date" />
            </label>
            <label class="nf-field">
              <span class="nf-label">正文</span>
              <textarea
                v-model="noteForm.content"
                rows="8"
                placeholder="笔记内容…（回车换行会保留）"
              ></textarea>
            </label>
          </div>
          <div class="nf-actions">
            <button v-if="editingNoteId" class="btn-outline nf-danger" @click="removeCurrentNote">
              删除笔记
            </button>
            <span class="nf-spacer"></span>
            <button class="btn-outline" @click="noteModalOpen = false">取消</button>
            <button
              class="btn-outline btn-solid"
              :disabled="!noteForm.title.trim()"
              @click="saveNote"
            >
              保存
            </button>
          </div>
        </BaseModal>

        <!-- chats: 关系 tab（第一版手动关联，无 AI） -->
        <div v-show="activeTab === 'relations'" class="tab-panel">
          <!-- chats: 关系版面——左边「中心锚点」+ 右边四组。
               上一版是 2×2 四张卡片，形状统一但彼此孤立：看不出这四组都挂在同一条知识上，
               也看不出「前置 / 相关」和「资料 / 项目」不是一回事。
               所以左边补一个中心锚点（当前条目 + 状态 + 总数 + 四类小计），
               左右之间留一条竖线当导轨——右侧四组才算「接在这个中心上」，而不是四个并排的盒子。
               右侧四张卡仍沿用 2×2：标题 + 方向图标 + 数量 + 行尾「+ 添加」，
               输入控件收在「+ 添加」里，点开才出现、加完自动收起。 -->
          <div class="rel-wrap">
            <aside class="rel-anchor">
              <p class="ra-eyebrow">当前条目</p>
              <h3 class="ra-title">{{ item.title }}</h3>
              <span class="level-badge" :class="item.level">{{ item.level }}</span>

              <p class="ra-total">
                <b>{{ totalRelations }}</b> 项关联
              </p>
              <dl class="ra-breakdown">
                <div v-for="g in relGroups" :key="g.label" class="ra-row">
                  <dt>{{ g.label }}</dt>
                  <dd :class="{ zero: g.count === 0 }">{{ g.count }}</dd>
                </div>
              </dl>
            </aside>

            <div class="rel-grid">
              <!-- chats: 前置是四组里唯一「有方向」的，所以它占整行、内部分两段：
                   上段「我依赖」记录在本条身上，可加可删；
                   下段「依赖我的」是反查出来的（谁把本条列为前置），只读，
                   点一下跳到对方条目去维护——因为那条记录的归属权在对方身上。 -->
              <section class="rel-card rel-card-wide">
                <div class="rel-card-head">
                  <ArrowUp :size="15" :stroke-width="1.8" class="rel-icon" />
                  <h3 class="rel-title">前置知识</h3>
                  <button class="rel-add-trigger" @click="toggleAdd('prerequisites')">
                    {{ addingBlock === 'prerequisites' ? '收起' : '+ 添加' }}
                  </button>
                </div>
                <p class="rel-hint">先学会它们，本条才看得懂</p>
                <div class="rel-cols">
                  <div class="rel-seg">
                    <div class="rel-seg-head">
                      <span class="rel-seg-title">我依赖</span>
                      <span class="rel-count" :class="{ zero: prerequisites.length === 0 }">
                        {{ prerequisites.length }}
                      </span>
                    </div>
                    <div class="rel-list">
                      <span v-for="id in prerequisites" :key="id" class="rel-chip">
                        {{ knowledgeTitle(id) }}
                        <button class="rel-remove" @click="removeRelation('prerequisites', id)">
                          ×
                        </button>
                      </span>
                      <span v-if="prerequisites.length === 0" class="rel-empty">暂无</span>
                    </div>
                    <!-- 改掉原来「选一下就立即生效」的 @change：先选、再点「添加」确认，避免误触 -->
                    <div v-if="addingBlock === 'prerequisites'" class="rel-add">
                      <select v-model="prereqSelect" class="rel-select">
                        <option value="">选择条目…</option>
                        <option v-for="k in otherKnowledgeItems" :key="k.id" :value="k.id">
                          {{ k.title }}
                        </option>
                      </select>
                      <button class="btn-outline" @click="addPrereq">添加</button>
                    </div>
                  </div>

                  <div class="rel-seg">
                    <div class="rel-seg-head">
                      <span class="rel-seg-title">依赖我的</span>
                      <span class="rel-count" :class="{ zero: prereqInbound.length === 0 }">
                        {{ prereqInbound.length }}
                      </span>
                      <span class="rel-seg-auto">自动</span>
                    </div>
                    <div class="rel-list">
                      <button
                        v-for="k in prereqInbound"
                        :key="k.id"
                        class="rel-chip rel-chip-out"
                        :title="`${k.title} 把本条列为前置，点击前往`"
                        @click="goToItem(k.id!)"
                      >
                        {{ k.title }}
                        <span class="rel-out">↗</span>
                      </button>
                      <span v-if="prereqInbound.length === 0" class="rel-empty">暂无</span>
                    </div>
                  </div>
                </div>
              </section>

              <!-- chats: 相关知识语义上是对称的，所以「我加的」和「对方加我的」并成一条列表，
                   不拆成两段（拆了反而像两类东西）。来源靠 chip 的样式区分：
                   实线 = 我建的、可删；虚线带 ↗ = 对方建的、只读、点一下跳过去。 -->
              <section class="rel-card">
                <div class="rel-card-head">
                  <ArrowLeftRight :size="15" :stroke-width="1.8" class="rel-icon" />
                  <h3 class="rel-title">相关知识</h3>
                  <span class="rel-count" :class="{ zero: relatedRows.length === 0 }">
                    {{ relatedRows.length }}
                  </span>
                  <button class="rel-add-trigger" @click="toggleAdd('relatedKnowledge')">
                    {{ addingBlock === 'relatedKnowledge' ? '收起' : '+ 添加' }}
                  </button>
                </div>
                <p class="rel-hint">同一层级的平行知识</p>
                <div class="rel-list">
                  <template v-for="row in relatedRows" :key="row.id">
                    <span v-if="!row.inbound" class="rel-chip">
                      {{ knowledgeTitle(row.id) }}
                      <button
                        class="rel-remove"
                        @click="removeRelation('relatedKnowledge', row.id)"
                      >
                        ×
                      </button>
                    </span>
                    <!-- 对方标的：本页删不掉（删了自己这边，反查立刻又把它显示回来），只能跳过去改 -->
                    <button
                      v-else
                      class="rel-chip rel-chip-out"
                      :title="`${knowledgeTitle(row.id)} 把本条列为相关知识，点击前往`"
                      @click="goToItem(row.id)"
                    >
                      {{ knowledgeTitle(row.id) }}
                      <span class="rel-out">↗</span>
                    </button>
                  </template>
                  <span v-if="relatedRows.length === 0" class="rel-empty">暂无</span>
                </div>
                <div v-if="addingBlock === 'relatedKnowledge'" class="rel-add">
                  <select v-model="relatedSelect" class="rel-select">
                    <option value="">选择条目…</option>
                    <option v-for="k in otherKnowledgeItems" :key="k.id" :value="k.id">
                      {{ k.title }}
                    </option>
                  </select>
                  <button class="btn-outline" @click="addRelated">添加</button>
                </div>
              </section>

              <section class="rel-card">
                <div class="rel-card-head">
                  <FileText :size="15" :stroke-width="1.8" class="rel-icon" />
                  <h3 class="rel-title">相关资料</h3>
                  <span class="rel-count" :class="{ zero: relatedMaterials.length === 0 }">
                    {{ relatedMaterials.length }}
                  </span>
                  <button class="rel-add-trigger" @click="toggleAdd('relatedMaterials')">
                    {{ addingBlock === 'relatedMaterials' ? '收起' : '+ 添加' }}
                  </button>
                </div>
                <p class="rel-hint">外部链接、书名、参考材料（文件本身放「资料」tab）</p>
                <div class="rel-list">
                  <span v-for="text in relatedMaterials" :key="text" class="rel-chip">
                    {{ text }}
                    <button class="rel-remove" @click="removeRelation('relatedMaterials', text)">
                      ×
                    </button>
                  </span>
                  <span v-if="relatedMaterials.length === 0" class="rel-empty">暂无</span>
                </div>
                <div v-if="addingBlock === 'relatedMaterials'" class="rel-add">
                  <input
                    v-model="materialInput"
                    class="rel-input"
                    placeholder="资料标题 / 链接"
                    @keyup.enter="addMaterial"
                  />
                  <button class="btn-outline" @click="addMaterial">添加</button>
                </div>
              </section>

              <section class="rel-card">
                <div class="rel-card-head">
                  <FolderKanban :size="15" :stroke-width="1.8" class="rel-icon" />
                  <h3 class="rel-title">相关项目</h3>
                  <span class="rel-count" :class="{ zero: relatedProjects.length === 0 }">
                    {{ relatedProjects.length }}
                  </span>
                  <button class="rel-add-trigger" @click="toggleAdd('relatedProjects')">
                    {{ addingBlock === 'relatedProjects' ? '收起' : '+ 添加' }}
                  </button>
                </div>
                <p class="rel-hint">用上这条知识的项目</p>
                <div class="rel-list">
                  <span v-for="id in relatedProjects" :key="id" class="rel-chip">
                    {{ projectTitle(id) }}
                    <button class="rel-remove" @click="removeRelation('relatedProjects', id)">
                      ×
                    </button>
                  </span>
                  <span v-if="relatedProjects.length === 0" class="rel-empty">暂无</span>
                </div>
                <div v-if="addingBlock === 'relatedProjects'" class="rel-add">
                  <select v-model="projectSelect" class="rel-select">
                    <option value="">选择项目…</option>
                    <option v-for="p in projectStore.projects" :key="p.id" :value="p.id">
                      {{ p.name }}
                    </option>
                  </select>
                  <button class="btn-outline" @click="addProject">添加</button>
                </div>
              </section>
            </div>
          </div>
        </div>

        <!-- chats: 资料 tab（原「附件」面板整体搬来） -->
        <div v-show="activeTab === 'materials'" class="tab-panel">
          <div class="attachments-panel">
            <div class="upload-area">
              <!-- chats: 上传区参考 UIverse 的「Project Structure tooltip」组件改版（2026-10-10）——
                   图标+文字触发器，悬停放出说明面板，原来那条一长串 hint 文字收进面板；
                   样式从 Tailwind 翻译成 tokens，过渡 1s 太慢改用 --transition-fast -->
              <!-- local-first：支持 FSAA 的浏览器优先用「只记句柄」方式，文件内容不进 IndexedDB -->
              <!-- chats: 修复本地优先按钮漏绑定的 @click（之前没绑定，点了没反应） -->
              <div v-if="supportsFsaa" class="upload-tip">
                <button class="upload-trigger" @click="addViaHandle">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 18 14" height="20" width="20">
                    <path
                      fill="#FFA000"
                      d="M16.2 1.75H8.1L6.3 0H1.8C0.81 0 0 0.7875 0 1.75V12.25C0 13.2125 0.81 14 1.8 14H15.165L18 9.1875V3.5C18 2.5375 17.19 1.75 16.2 1.75Z"
                    ></path>
                    <path
                      fill="#FFCA28"
                      d="M16.2 2H1.8C0.81 2 0 2.77143 0 3.71429V12.2857C0 13.2286 0.81 14 1.8 14H16.2C17.19 14 18 13.2286 18 12.2857V3.71429C18 2.77143 17.19 2 16.2 2Z"
                    ></path>
                  </svg>
                  <span>添加本地文件（本地优先）</span>
                </button>
                <div class="upload-pop">
                  <p>只记录文件位置，内容不出本机。图片会抄一份快照进浏览器私有存储，重启后预览不丢。</p>
                  <p class="up-fmt">支持 JPG / PNG / GIF / WebP / PDF</p>
                </div>
              </div>
              <!-- 兼容模式：Firefox 等不支持 FSAA 时，降级为把内容转 Base64 入库 -->
              <div class="upload-tip">
                <button class="upload-trigger" @click="triggerFilePicker">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" height="20" width="20">
                    <path
                      d="M12 15V5m0 0-4 4m4-4 4 4"
                      stroke="#8E8E8E"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    ></path>
                    <path d="M4 20h16" stroke="#8E8E8E" stroke-width="2" stroke-linecap="round"></path>
                  </svg>
                  <span>上传附件（兼容）</span>
                </button>
                <div class="upload-pop">
                  <p v-if="supportsFsaa">
                    备用通道：文件内容转 Base64 直接存进本地数据库，任何浏览器都能用。
                  </p>
                  <p v-else>当前浏览器不支持本地优先，已自动用兼容模式：文件内容转 Base64 存进本地数据库。</p>
                  <p class="up-fmt">支持 JPG / PNG / GIF / WebP / PDF</p>
                </div>
              </div>
              <!-- 修改：accept 加上 application/pdf，允许上传 PDF；multiple 允许一次选多个 -->
              <input
                ref="fileInput"
                type="file"
                accept="image/*,application/pdf"
                multiple
                style="display: none"
                @change="handleFileChange"
              />
            </div>

            <div v-if="item.attachments && item.attachments.length > 0" class="attachment-list">
              <div v-for="att in item.attachments" :key="att.id" class="attachment-item">
                <img
                  v-if="att.type && att.type.startsWith('image/')"
                  :src="previewUrls[att.id] || att.data || undefined"
                  class="attachment-preview"
                />
                <!-- 新增：非图片（如 PDF）显示占位图标，避免布局错位 -->
                <div v-else class="attachment-preview file-icon">PDF</div>
                <div class="attachment-info">
                  <span class="attachment-name">{{ att.name }}</span>
                  <span class="attachment-date">{{ formatDate(att.dateAdded) }}</span>
                  <!-- chats: 快照也救不回（老附件从没抄过快照 + 权限被收）才出现；
                       点击 = 用户手势里请求授权，Chrome 122+ 可选「每次访问都允许」 -->
                  <button
                    v-if="authNeededIds.includes(att.id)"
                    class="btn-outline reauth-btn"
                    @click="reauthorizeAttachment(att)"
                  >
                    重新授权
                  </button>
                </div>
                <!-- 新增：PDF 附件才显示「阅读」按钮，点了跳去 PDF 阅读器 -->
                <button
                  v-if="att.type === 'application/pdf'"
                  class="btn-outline read-btn"
                  @click="handleReadPdf(att)"
                >
                  阅读
                </button>
                <button class="delete-btn" @click="handleRemoveAttachment(att.id)">×</button>
              </div>
            </div>
            <div v-else class="empty-attachments">
              <p>暂无附件，点击上方按钮上传</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useKnowledgeStore } from '@/stores/knowledgeStore'
// 新增：PDF 中转 store，用于把知识库的 PDF 附件送到 PDF 阅读器
import { usePDFStore } from '@/stores/PDFStore'
// chats: 关系「相关项目」需要读项目列表
import { useProjectStore } from '@/stores/projectStore'
import type { Attachment, KnowledgeItem } from '@/types'
import MindMap from '@/components/MindMap.vue'
import Lightbox from '@/components/Lightbox.vue'
import BaseModal from '@/components/BaseModal.vue'
import { generateMindMapWithAI } from '@/services/mindMap'
// chats: 附件 OPFS 快照（方案③）——句柄权限重启会被收，显示退快照、原文件变了重抄
import {
  queryHandlePermission,
  readSnapshot,
  requestHandlePermission,
  saveSnapshot,
} from '@/services/attachmentSnapshot'
// chats: formatDate 抽到 src/utils/date.ts 统一维护（原先这里和列表项组件各有一份一模一样的实现）
import { formatDate } from '@/utils/date'
import { showError, showSuccess } from '@/utils/toast'
// chats: 关系四组的方向图标（前置=上游 / 相关=平行 / 资料=材料 / 项目=落地），
// 用图标区分四张卡的角色，比再写一行说明字更省地方，也和侧边栏同一套图标语言
import { ArrowLeftRight, ArrowUp, FileText, FolderKanban } from 'lucide-vue-next'

const fileInput = ref<HTMLInputElement | null>(null)
const route = useRoute()
const router = useRouter()
const store = useKnowledgeStore()
// chats: 项目 store（相关项目下拉 + 反查标题）
const projectStore = useProjectStore()

const item = ref<KnowledgeItem | null>(null)
const loading = ref(true)

// local-first：浏览器是否支持 File System Access API（Chrome/Edge 支持，Firefox 不支持）。
// 支持时走「只存文件句柄、不存内容」的本地优先模式；不支持时降级回 Base64（兼容模式）。
const supportsFsaa = typeof (window as any).showOpenFilePicker === 'function'

// 句柄附件（无 Base64）的图片预览地址，按 attachment.id 缓存；从句柄现读文件生成。
const previewUrls = ref<Record<string, string>>({})
// chats: 快照也救不回（没抄过快照 + 权限被收）的附件 id——列表里给「重新授权」按钮
const authNeededIds = ref<string[]>([])

// chats: 四 tab 重构
const tabs = [
  { key: 'overview', label: '概览' },
  { key: 'knowledge', label: '笔记' },
  { key: 'materials', label: '资料' },
  { key: 'relations', label: '关系' },
]
const activeTab = ref('overview')

// ===== 笔记 tab 的横向笔记条 =====
// chats: 笔记一对多已落地（Note[]），横条直接渲染真数据；
// 点条目打开笔记弹窗（查看/编辑/删除），右键是快捷菜单
const isNotesBarOpen = ref(true)

interface NoteEntry {
  id: string
  title: string
  content: string
  date: string
}

const noteEntries = computed<NoteEntry[]>(() =>
  (item.value?.notes ?? []).map((n) => ({
    id: n.id,
    title: n.title,
    content: n.content,
    date: n.date,
  })),
)

// ===== 笔记阅读区 + 弹窗（阅读在条内，新建/修改走 BaseModal） =====
const noteModalOpen = ref(false)
const editingNoteId = ref<string | null>(null) // null = 新建模式
const noteForm = ref({ title: '', date: '', content: '' })
// chats: 阅读区选中态——存 id 而不是存整篇，笔记改完 loadItem 刷新后内容自动跟着新
const viewingNoteId = ref<string | null>(null)
const viewingNote = computed(
  () => item.value?.notes?.find((n) => n.id === viewingNoteId.value) ?? null,
)

function openCreateNote() {
  editingNoteId.value = null
  noteForm.value = { title: '', date: new Date().toISOString().slice(0, 10), content: '' }
  noteModalOpen.value = true
}

// chats: 点笔记条目 = 下方阅读区放出这篇（2026-10-10 用户本意：openNote 是「打开看」，
// 不弹窗）；再点同一篇 = 收起。编辑入口在阅读区右上角按钮 / 右键菜单
function openNote(id: string) {
  viewingNoteId.value = viewingNoteId.value === id ? null : id
}

// chats: 右键「修改笔记」/ 阅读区「编辑」= 弹窗表单（找笔记 → 回填 → 开弹窗）
function openNoteEditor(id: string) {
  const n = (item.value?.notes ?? []).find((x) => x.id === id)
  if (!n) return
  editingNoteId.value = id
  noteForm.value = { title: n.title, date: n.date, content: n.content }
  noteModalOpen.value = true
}

async function saveNote() {
  if (!item.value?.id) return
  const title = noteForm.value.title.trim()
  if (!title) return // 保存按钮在标题为空时已禁用，这里是快捷键路径的兜底
  try {
    if (editingNoteId.value) {
      await store.updateNote(item.value.id, editingNoteId.value, {
        title,
        content: noteForm.value.content,
        date: noteForm.value.date,
      })
      showSuccess('笔记已保存')
    } else {
      await store.addNote(item.value.id, {
        title,
        content: noteForm.value.content,
        date: noteForm.value.date,
      })
      showSuccess('笔记已新建')
    }
    noteModalOpen.value = false
    await loadItem(false) // chats: item 是本地 ref，store 写完要手动刷新本条（同 saveEdit）
  } catch (error) {
    // chats: 保存失败必须说话——之前 IDB 克隆失败是静默的，表现就是「点了没反应」
    console.error('保存笔记失败:', error)
    showError('保存笔记失败：' + (error instanceof Error ? error.message : String(error)))
  }
}

async function removeCurrentNote() {
  if (!item.value?.id || !editingNoteId.value) return
  await store.deleteNote(item.value.id, editingNoteId.value)
  noteModalOpen.value = false
  if (viewingNoteId.value === editingNoteId.value) viewingNoteId.value = null // chats: 删的就是正在看的那篇，阅读区一起收
  await loadItem(false) // chats: 同上，删完刷新
  showSuccess('笔记已删除')
}

// chats: 点「笔记」以外的 tab 直接切换；在「笔记」tab 上再点一次 = 放出/收起笔记条
function onTabClick(tab: { key: string; label: string }) {
  if (tab.key !== 'knowledge') {
    activeTab.value = tab.key
    return
  }
  if (activeTab.value === 'knowledge') {
    isNotesBarOpen.value = !isNotesBarOpen.value
  } else {
    activeTab.value = 'knowledge'
    isNotesBarOpen.value = true // 从别的 tab 切进来，笔记条默认放出
  }
}

// ===== 笔记右键菜单 =====
// chats: 修改 = 打开笔记弹窗；分享优先系统分享、不支持就退剪贴板；
// 下载把笔记落成 .md。没有「打开所在文件夹」——笔记是 IndexedDB 里的文本，
// 不是磁盘文件，没有文件夹可开（附件才有句柄和真实路径）
const noteMenu = ref({ visible: false, x: 0, y: 0, noteId: 'main' })

function openNoteMenu(e: MouseEvent, n: NoteEntry) {
  noteMenu.value = {
    visible: true,
    // 菜单约 180×130，贴右/下边缘时往回 clamp，防止弹出到视口外
    x: Math.min(e.clientX, window.innerWidth - 190),
    y: Math.min(e.clientY, window.innerHeight - 150),
    noteId: n.id,
  }
}

function closeNoteMenu() {
  noteMenu.value.visible = false
}

function noteMenuAction(action: 'edit' | 'share' | 'download') {
  const n = noteEntries.value.find((e) => e.id === noteMenu.value.noteId)
  closeNoteMenu()
  if (!n) return

  if (action === 'edit') {
    openNoteEditor(n.id)
    return
  }

  if (action === 'share') {
    if (navigator.share) {
      // 用户点取消（AbortError）不打扰，其余错误也静默——分享失败不该打断浏览
      navigator.share({ title: n.title, text: n.content }).catch(() => {})
    } else {
      navigator.clipboard
        .writeText(n.content)
        .then(() => showSuccess('当前浏览器不支持系统分享，笔记全文已复制到剪贴板'))
    }
    return
  }

  if (action === 'download') {
    // 文件名只留安全字符（Windows 文件名禁止 \ / : * ? " < > |）
    const blob = new Blob([n.content], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${n.title.replace(/[\\/:*?"<>|]/g, '_')}.md`
    a.click()
    URL.revokeObjectURL(url)
  }
}

// ===== 编辑模式 =====
// chats: 笔记一对多后，笔记的增改删走「笔记弹窗」（addNote/updateNote/deleteNote），
// 页头编辑只管标题/状态/描述这三样本来就显示在页头的字段
const isEditing = ref(false)
const editTitle = ref('')
const editDesc = ref('') // 短描述（头部摘要）
const editLevel = ref<'已学会' | '学习中' | '待学习'>('学习中')

function startEdit() {
  if (!item.value) return
  editTitle.value = item.value.title
  editDesc.value = item.value.description || ''
  editLevel.value = item.value.level
  isEditing.value = true
}

async function saveEdit() {
  if (!item.value) return
  // chats: 这里原来是 alert('标题不能为空')。现在保存按钮在标题为空时就是禁用的，
  // 快捷键路径上面也先判过了，所以这里静默返回，不再用弹窗打断。
  if (!editTitle.value.trim()) return
  await store.updateItem(item.value.id!, {
    title: editTitle.value,
    description: editDesc.value,
    level: editLevel.value,
  })
  isEditing.value = false
  loadItem(false) // chats: 保存后刷新本条数据，避免编辑态和常态数据不同步
}

function cancelEdit() {
  isEditing.value = false
}

// chats: 三个状态抽成常量数组，供页头那排按钮 v-for。
// 原来编辑态是在模板里手写三行 <option>，改一次要改两处（类型定义 + 模板）。
// 类型直接复用 KnowledgeItem['level']，不另外起一个联合类型，避免两处定义漂移。
const levelOptions: Array<KnowledgeItem['level']> = ['已学会', '学习中', '待学习']

// ===== 关系（chats: 第一版手动关联，本地 ref 与 item 字段同步） =====
// 四种关系的字段名，写一次给 toggleAdd / removeRelation 共用，避免在几处重复写联合类型
type RelationKind = 'prerequisites' | 'relatedKnowledge' | 'relatedMaterials' | 'relatedProjects'

const prerequisites = ref<number[]>([])
const relatedKnowledge = ref<number[]>([])
const relatedMaterials = ref<string[]>([])
const relatedProjects = ref<string[]>([])
const prereqSelect = ref('')
const relatedSelect = ref('')
const projectSelect = ref('')
const materialInput = ref('')

// chats: 当前展开了「添加」输入区的分组，null = 四张卡都收起。
// 原来四个原生下拉框常驻在页面上，又占地方又不好看；改成点「+ 添加」才展开，
// 添加成功或再点一次「收起」就关掉。
const addingBlock = ref<RelationKind | null>(null)

function toggleAdd(kind: RelationKind) {
  addingBlock.value = addingBlock.value === kind ? null : kind
}

// chats: 子条目已下线，条目就是一层平铺，关系下拉直接用全库列表
const otherKnowledgeItems = computed(() => store.items.filter((k) => k.id !== item.value?.id))

// chats: 概览两卡的横滚区——竖滚轮转横滚。deltaY 是滚轮「竖着滚了多少」，
// 直接加到 scrollLeft（横着滚多少）就完成换向；.prevent 拦掉默认行为，页面不跟着竖滚
function onCardWheel(e: WheelEvent) {
  const el = e.currentTarget as HTMLElement
  el.scrollLeft += e.deltaY
}

// ===== 概览附件卡的图片缩略图 + 灯箱 =====
// chats: 能当图显示的附件 = 类型是图片 且 拿得到内容（句柄的 blob URL 或 Base64 降级）
function isImageAttachment(att: Attachment): boolean {
  return Boolean(att.type?.startsWith('image/') && (previewUrls.value[att.id] || att.data))
}

function openLightbox(att: Attachment) {
  const src = previewUrls.value[att.id] || att.data || ''
  if (src) lightboxSrc.value = src
}

const lightboxSrc = ref('')

// chats: 灯箱多图导航——把「能看的图」整列发给灯箱（缩略图同源，isImageAttachment 筛选），
// ←/→ 或两侧圆钮触发 nav 时在这列里循环换 lightboxSrc。
// 真相源仍是父组件的 lightboxSrc：灯箱只发事件不自己换图，避免两处状态打架
const lightboxImages = computed(() =>
  (item.value?.attachments ?? [])
    .filter(isImageAttachment)
    .map((a) => previewUrls.value[a.id] || a.data || '')
    .filter(Boolean),
)

function onLightboxNav(dir: 1 | -1) {
  const list = lightboxImages.value
  if (list.length < 2) return
  // 当前图可能不在列表首位：indexOf 找不到（-1，如句柄预览还没生成）就回第一张
  const idx = list.indexOf(lightboxSrc.value)
  const next = list[(idx === -1 ? 0 : idx + dir + list.length) % list.length]
  // noUncheckedIndexedAccess：下标取值是 string | undefined，判空过编译
  if (next != null) lightboxSrc.value = next
}

// chats: 关系双向——记录只存在「声明方」身上（A 声明「前置是 B」，这条就只存在 A 里），
// 所以「谁依赖我」这种反向关系靠反查全库得出来：不改数据结构、不用迁移历史数据、
// 条目一删反向也跟着消失。本地个人库数据量小，全量遍历的成本可以忽略。
const prereqInbound = computed(() => {
  const myId = item.value?.id
  if (myId == null) return []
  return store.items.filter((k) => k.id !== myId && k.prerequisites?.includes(myId))
})

// 相关知识在语义上是对称的，所以把「我加它的」和「它加我的」并成一条列表，
// 只用一个 inbound 标记区分来源：
// inbound=true 表示记录存在对方身上，本页删不掉（删了自己这边，反查立刻又把它显示回来），
// 只能点进去改。
const relatedRows = computed(() => {
  const rows: Array<{ id: number; inbound: boolean }> = []
  for (const id of relatedKnowledge.value) rows.push({ id, inbound: false })
  const myId = item.value?.id
  if (myId == null) return rows
  for (const k of store.items) {
    if (k.id == null || k.id === myId) continue
    if (!k.relatedKnowledge?.includes(myId)) continue
    if (rows.some((r) => r.id === k.id)) continue
    rows.push({ id: k.id, inbound: true })
  }
  return rows
})

// chats: 反查出来的关系记录在对方身上，本页只能看不能改，给个入口跳过去——
// 否则用户看到一条「依赖我的」，既不知道是谁、也没法去维护。
function goToItem(id: number) {
  router.push({ name: 'KnowledgeDetail', params: { id } })
}

// chats: 左栏「中心锚点」的汇总——四组各几个、合计几个。
// 数据源还是那四个 ref 加上面的反查结果，只换个视角读一遍，不额外存一份状态
// （两份数据迟早打架）。这里的数字要和右栏卡片对得上，所以前置算的是
// 「我依赖 + 依赖我的」两段之和，相关知识算的是合并去重后的条数。
const relGroups = computed(() => [
  { label: '前置知识', count: prerequisites.value.length + prereqInbound.value.length },
  { label: '相关知识', count: relatedRows.value.length },
  { label: '相关资料', count: relatedMaterials.value.length },
  { label: '相关项目', count: relatedProjects.value.length },
])
const totalRelations = computed(() => relGroups.value.reduce((sum, g) => sum + g.count, 0))

// TODO: 反向关系已由上面的反查覆盖，但正向的死引用还没清——删掉条目 B 后，
// 曾经声明过「前置是 B」的 A 里仍然留着那个 id，界面会显示「未知条目(#3)」。
// 要根治得在 knowledgeStore.deleteItem 里扫全库剔除该 id。
function knowledgeTitle(id: number): string {
  return store.findItemById(id)?.title ?? `未知条目(#${id})`
}
function projectTitle(id: string): string {
  return projectStore.projects.find((p) => p.id === id)?.name ?? `未知项目(${id})`
}

function addPrereq() {
  const id = Number(prereqSelect.value)
  if (id) {
    if (!prerequisites.value.includes(id)) prerequisites.value.push(id)
    prereqSelect.value = ''
    addAndClose()
  }
}
function addRelated() {
  const id = Number(relatedSelect.value)
  if (id) {
    if (!relatedKnowledge.value.includes(id)) relatedKnowledge.value.push(id)
    relatedSelect.value = ''
    addAndClose()
  }
}
function addProject() {
  const id = projectSelect.value
  if (id) {
    if (!relatedProjects.value.includes(id)) relatedProjects.value.push(id)
    projectSelect.value = ''
    addAndClose()
  }
}
function addMaterial() {
  const text = materialInput.value.trim()
  if (text) {
    if (!relatedMaterials.value.includes(text)) relatedMaterials.value.push(text)
    materialInput.value = ''
    addAndClose()
  }
}
// chats: 四个 add* 收尾动作一样——落库 + 收起添加区。抽出来避免复制四遍。
function addAndClose() {
  addingBlock.value = null
  persistRelations()
}
function removeRelation(kind: RelationKind, id: number | string) {
  if (kind === 'prerequisites') prerequisites.value = prerequisites.value.filter((x) => x !== id)
  else if (kind === 'relatedKnowledge')
    relatedKnowledge.value = relatedKnowledge.value.filter((x) => x !== id)
  else if (kind === 'relatedProjects')
    relatedProjects.value = relatedProjects.value.filter((x) => x !== id)
  else relatedMaterials.value = relatedMaterials.value.filter((x) => x !== id)
  persistRelations()
}
// chats: 把四个关系数组一次性写回（updateItem 只合并已传字段，不用加新 API）
async function persistRelations() {
  if (!item.value) return
  await store.updateItem(item.value.id!, {
    prerequisites: prerequisites.value,
    relatedKnowledge: relatedKnowledge.value,
    relatedMaterials: relatedMaterials.value,
    relatedProjects: relatedProjects.value,
  })
  await loadItem(false)
}

// ===== 加载数据 =====
async function loadItem(showLoading = true) {
  // 路由参数是 id（字符串），要转成数字才能和数据库里的 id 比对
  const id = Number(route.params.id)
  if (!id || Number.isNaN(id)) {
    loading.value = false
    return
  }

  // 🔧 修复：原来无条件 loading.value = true，生成导图/保存笔记后的重查会把整页
  // 卸载重挂（v-if="loading"），看起来像刷新。改为由调用方决定是否显示加载态。
  if (showLoading) loading.value = true

  try {
    // chats: 关键修复——始终 await 知识库数据加载完成再查找，不再用
    // `store.items.length === 0` 提前跳过。刷新详情页是全新会话，store 初始化加载
    // 与本次加载可能并发，跳过判断会让 findItemById 用半初始化数据而查不到，
    // 直接显示「知识库不存在」。loadItems 已做单飞，重复 await 不会重复读库。
    await store.loadItems()

    // chats: 主数据就绪后再查，找到才赋值；找不到单独处理（不进 catch，避免和异常混淆）
    const found = store.findItemById(id)
    if (!found) {
      console.warn('[loadItem] 未找到该条目', { id, itemsCount: store.items.length })
      item.value = null
      return
    }
    item.value = found

    // 修复：切换到另一个条目前先退出编辑态。
    // 否则上一个条目的标题/描述还留在编辑框里，一保存就写到新条目上了。
    isEditing.value = false

    // chats: 进入条目时把关系字段同步到本地 ref
    prerequisites.value = found.prerequisites ?? []
    relatedKnowledge.value = found.relatedKnowledge ?? []
    relatedMaterials.value = found.relatedMaterials ?? []
    relatedProjects.value = found.relatedProjects ?? []
  } catch (error) {
    // 只有「知识库数据本身加载失败」(如 IndexedDB 异常) 才判定为不存在
    console.error('[loadItem] 知识库数据加载失败:', error)
    item.value = null
  } finally {
    loading.value = false
  }

  // chats: 项目列表 / 图片预览属于「辅助数据」，失败不应让主内容变「知识库不存在」。
  // 原本这行直接 await 在 try 内，一旦 projectStore.loadProjects() 抛错（刷新时
  // projects 为空必然走到），catch 就会把 item 清空 → 这就是刷新报「不存在」的根因。
  try {
    if (projectStore.projects.length === 0) {
      await projectStore.loadProjects()
    }
    // local-first：句柄附件的图片预览需从句柄重新读文件
    await resolvePreviews()
  } catch (error) {
    console.warn('[loadItem] 辅助数据加载失败（不影响主内容显示）:', error)
  }
}

// chats: 子条目已下线，条目都是顶层，返回永远回知识库列表
function goBack() {
  router.push({ name: 'Knowledge' })
}

// ===== 附件操作 =====
function triggerFilePicker() {
  fileInput.value?.click()
}

async function handleFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  // chats: 支持多选——files 是 FileList（类数组），先转成真数组再逐个入库
  const files = Array.from(input.files ?? [])
  if (files.length === 0 || !item.value) return

  try {
    for (const file of files) {
      await store.addAttachment(item.value.id!, file)
    }
    await loadItem(false)
    input.value = ''
  } catch (error) {
    console.error('上传失败:', error)
    alert('上传失败，请重试')
  }
}

// local-first：用 File System Access API 选文件，只把「文件句柄」存进 IndexedDB，
// 不存文件内容。重开时再向用户要一次授权、从句柄读回文件。Firefox 不支持时走上面的 Base64 兼容模式。
async function addViaHandle() {
  if (!item.value) return
  try {
    const handles = await (window as any).showOpenFilePicker({
      // chats: 允许一次选多个文件
      multiple: true,
      types: [
        {
          description: '图片或 PDF',
          accept: {
            'application/pdf': ['.pdf'],
            'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
          },
        },
      ],
    })
    // 句柄是结构化克隆安全的对象，可直接存进 IndexedDB
    for (const handle of handles) {
      await store.addAttachmentByHandle(item.value.id!, handle)
    }
    await loadItem(false)
  } catch (error: any) {
    // 用户按了取消（AbortError）就不打扰；其他错误才提示
    if (error?.name !== 'AbortError') {
      console.error('添加文件失败:', error)
      alert('添加文件失败，请重试')
    }
  }
}

// chats: 切换详情页 / 反复预览前先释放旧 Blob URL，避免越积越多
function revokePreviews() {
  Object.values(previewUrls.value).forEach((url) => {
    if (url.startsWith('blob:')) URL.revokeObjectURL(url)
  })
}

// local-first：句柄附件（无 Base64）的图片预览，需要从句柄现读文件生成临时 URL。
// 图片用 URL.createObjectURL，PDF 不需要预览图（显示占位图标）。
//
// chats: 方案③解析优先级（2026-10-10）——
//   ① 句柄有权限 → 直读原文件；顺手对比 lastModified/size，原文件变过就重抄快照（跟着更新）
//   ② 权限被收（重启常态）→ 退 OPFS 快照，缩略图照样亮
//   ③ 快照也没有（老附件从没抄过）→ 记入 authNeededIds，列表里出「重新授权」按钮
async function resolvePreviews() {
  revokePreviews() // chats: 先释放旧的，再生成新的
  if (!item.value?.attachments) {
    previewUrls.value = {}
    authNeededIds.value = []
    return
  }
  const urls: Record<string, string> = {}
  const needsAuth: string[] = []
  for (const att of item.value.attachments) {
    if (att.handle && att.type?.startsWith('image/')) {
      const file = await resolveHandleImage(att, needsAuth)
      if (file) urls[att.id] = URL.createObjectURL(file)
    }
  }
  previewUrls.value = urls
  authNeededIds.value = needsAuth
}

// chats: 单个句柄图片的三级解析（见 resolvePreviews 注释）。快照重抄后的元信息
// 回写走 store.updateAttachmentSnapshot，那边 loadItems 会再触发一次解析——
// 第二轮对比相等就不再写，不会循环
async function resolveHandleImage(att: Attachment, needsAuth: string[]): Promise<File | null> {
  const handle = att.handle
  if (!handle || !item.value) return null

  if ((await queryHandlePermission(handle)) === 'granted') {
    try {
      const file = await handle.getFile()
      const snap = att.snapshot
      // 快照没抄过、或原文件 lastModified/size 变了 = 该重抄（旧附件在这里自动补快照）
      if (snap?.lastModified !== file.lastModified || snap?.size !== file.size) {
        const meta = await saveSnapshot(att.id, file)
        if (meta) void store.updateAttachmentSnapshot(item.value.id, att.id, meta)
      }
      return file
    } catch {
      // 有权限但文件被移走/读炸：往下退快照
    }
  }

  // 权限被收（重启常态）：退 OPFS 快照，显示不受影响
  const snapFile = await readSnapshot(att.id)
  if (snapFile) return snapFile

  needsAuth.push(att.id) // 快照也没有：只能等用户点「重新授权」
  return null
}

// chats: 「重新授权」按钮（点击 = 用户手势，requestPermission 只能在手势里调）。
// Chrome 122+ 弹三选项，选「每次访问都允许」以后重启也不再问。
// 授权成功立刻补抄快照，老附件从此上岸
async function reauthorizeAttachment(att: Attachment) {
  const handle = att.handle
  if (!handle || !item.value) return
  const perm = await requestHandlePermission(handle)
  if (perm !== 'granted') {
    showError('未获得文件访问权限，缩略图将继续使用快照')
    return
  }
  try {
    const file = await handle.getFile()
    const meta = await saveSnapshot(att.id, file)
    if (meta) await store.updateAttachmentSnapshot(item.value.id, att.id, meta)
    await loadItem(false) // 重新解析预览
    showSuccess('已重新授权，图片预览恢复')
  } catch (error) {
    // 授权成功但文件本身读不到（被移动/删除）
    console.error('重新授权后读取文件失败:', error)
    showError('授权成功，但原文件读不到了（可能被移动或删除）')
  }
}

// 改动：阅读 PDF 时，有句柄就带句柄（local-first 模式，不依赖 Base64）；
// 没有句柄（兼容模式）才退回到 Base64 数据。
function handleReadPdf(att: Attachment) {
  const pdfStore = usePDFStore()
  // data 降级方案是可选的（本地优先模式可能没 Base64），没有就传空串
  pdfStore.open(att.data ?? '', att.name, att.handle)
  router.push('/pdf')
}

async function handleRemoveAttachment(attachmentId: string) {
  if (!item.value) return
  if (!confirm('确定删除此附件吗？')) return

  try {
    await store.removeAttachment(item.value.id!, attachmentId)
    await loadItem(false)
  } catch (error) {
    console.error('删除失败:', error)
    alert('删除失败，请重试')
  }
}

// ===== 思维导图 =====
const isGenerating = ref(false)

async function handleGenerateMindmap() {
  if (!item.value) return

  const current = item.value

  isGenerating.value = true
  try {
    await generateMindMapWithAI(
      current,
      undefined,
      (data) => {
        store.updateItem(current.id!, { mindmapData: data })
        loadItem(false) // chats: 生成完成后只换数据，不触发整页 loading
        isGenerating.value = false
      },
      (error) => {
        console.error('生成失败:', error)
        // chats: 把 service 层给的具体原因（如「条目无资料不可生成」）直接弹给用户，不再是笼统的请重试
        alert(error.message || '生成思维导图失败，请重试')
        isGenerating.value = false
      },
    )
  } catch (error) {
    console.error('生成失败:', error)
    isGenerating.value = false
  }
}

// chats: 编辑态的键盘操作——Esc 取消、Ctrl/Cmd + S 保存。
// 因为是挂在 document 上的，必须成对卸载：否则离开详情页后监听还活着，
// 会在其它页面把 Esc 和 Ctrl+S 一起吃掉（Ctrl+S 被拦掉后浏览器连「保存网页」都不弹了）。
function handleEditKeydown(e: KeyboardEvent) {
  if (!isEditing.value) return
  if (e.key === 'Escape') {
    cancelEdit()
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault() // 不拦的话浏览器会弹出「保存网页」对话框
    if (editTitle.value.trim()) saveEdit()
  }
}

onMounted(() => {
  loadItem()
  document.addEventListener('keydown', handleEditKeydown)
})

// chats: 组件卸载时释放 Blob URL，防止内存泄漏
onUnmounted(() => {
  revokePreviews()
  document.removeEventListener('keydown', handleEditKeydown)
})

// 修复：「进入子条目」时 URL 变了、页面内容却不变的根因。
// /knowledge/A → /knowledge/B 是同一条路由规则，Vue Router 会**复用同一个组件实例**，
// 不会销毁重建，所以 onMounted 只会在第一次执行。没有这个 watch，
// router.push 之后 route.params.id 变了但数据不会重新加载。
watch(
  () => route.params.id,
  () => {
    // chats: 换条目时先退出编辑态。isEditing 在组件实例上是共享的，
    // 不重置的话在 A 的编辑态里点进 B，B 一进来就是编辑态、输入框里还残留 A 的内容。
    isEditing.value = false
    loadItem()
    window.scrollTo({ top: 0 }) // 切换条目后回到顶部，否则停在上一页的滚动位置
  },
)
</script>

<style scoped>
.detail-view {
  max-width: 1100px;
  margin: 0 auto;
  /* chats: 修掉原来无效的 var(--spacing-)（变量名没写完，浏览器直接忽略），改为 var(--spacing-sm) 与侧栏对齐 */
  padding-top: var(--spacing-sm);
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  color: var(--color-text-placeholder);
}

/* ===== 头部 ===== */
.detail-header {
  margin-bottom: var(--spacing-lg);
  padding-bottom: var(--spacing-md);
  border-bottom: 1px solid var(--color-border);
}

/* chats: 快捷卡（笔记/附件）——点卡片跳到对应 tab，内容 nowrap 横向滚动。
   卡片放在概览 tab 的 .overview-cards 里平分一行宽度 */
.header-card {
  flex: 1;
  min-width: 0;
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-bg-white);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}
.header-card:hover {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-sm);
}
.hc-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: var(--spacing-xs);
}
.hc-label {
  font-size: var(--font-size-sm);
  font-weight: 600;
}
.hc-count {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}
.hc-scroll {
  overflow-x: auto;
  white-space: nowrap;
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  /* chats: 隐藏滚动条（之前是 thin 显示一条细的）——Firefox 用 scrollbar-width，
     Chromium/WebKit 不认它，要另配 ::-webkit-scrollbar，两条都得写 */
  scrollbar-width: none;
  padding-bottom: 2px;
  /* chats: 内容行高度是这一行自己的职责（SRP）——两张卡各自预留 44px，
     互不借高：笔记卡不用「把 chip 撑到 44」来凑高，附件卡也不会被笔记卡拉变形。
     44 与缩略图/笔记 chip 同高，两卡内容行天然等高，stretch 只补边框不挤内容 */
  min-height: 44px;
}
.hc-scroll::-webkit-scrollbar {
  display: none;
}
.hc-atts {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}
/* chats: 自定义横向滚动条（2026-10-09 用户要求）——灰底轨道 + 主题色滑块 +
   两端可点击的箭头按钮（::-webkit-scrollbar-button 是原生控件，点了真的会滚）。
   只有附件卡（.hc-atts）用这套；笔记条（.note-bar）2026-10-10 用户要求隐藏滚动条。
   Firefox 不支持 scrollbar-button，降级为 scrollbar-color 细条（无箭头，可接受） */
.hc-atts {
  scrollbar-width: thin;
  scrollbar-color: var(--color-text) var(--color-bg-hover);
}
.hc-atts::-webkit-scrollbar {
  display: block; /* 覆盖 .hc-scroll 的 display:none（同优先级，靠后者胜出） */
  height: 12px;
}
.hc-atts::-webkit-scrollbar-track {
  background: var(--color-bg-hover);
}
.hc-atts::-webkit-scrollbar-thumb {
  background: var(--color-primary);
  border-radius: var(--radius-sm);
}
.hc-atts::-webkit-scrollbar-thumb:hover {
  background: var(--color-primary-hover);
}
/* chats: 两端箭头——start:decrement=左尖头，end:increment=右尖头；
   只显式放开最外侧一对，Chrome 默认的内侧重叠按钮保持隐藏。
   箭头是 SVG data URI：CSS 变量进不了 url()，色值 #999 手写对齐 --color-text-placeholder */
.hc-atts::-webkit-scrollbar-button:horizontal:start:decrement,
.hc-atts::-webkit-scrollbar-button:horizontal:end:increment {
  display: block;
  width: 14px;
  height: 12px;
  background-color: var(--color-bg-hover);
  background-repeat: no-repeat;
  background-position: center;
}
.hc-atts::-webkit-scrollbar-button:horizontal:start:decrement {
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 8 8'><path d='M5.5 0.5 L1.5 4 L5.5 7.5 Z' fill='%23999999'/></svg>");
}
.hc-atts::-webkit-scrollbar-button:horizontal:end:increment {
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 8 8'><path d='M2.5 0.5 L6.5 4 L2.5 7.5 Z' fill='%23999999'/></svg>");
}
.hc-atts::-webkit-scrollbar-button:horizontal:start:decrement:hover,
.hc-atts::-webkit-scrollbar-button:horizontal:end:increment:hover {
  background-color: var(--color-border-light);
}
.hc-att {
  flex: 0 0 auto;
  padding: 2px 8px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}
/* chats: 图片附件缩略图——方形小图，点击弹灯箱看大图 */
.hc-thumb {
  flex: 0 0 auto;
  width: 44px;
  height: 44px;
  object-fit: cover;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: zoom-in;
  transition: transform 0.15s ease;
}
.hc-thumb:hover {
  transform: scale(1.08);
}
.hc-empty {
  color: var(--color-text-placeholder);
}

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-sm);
}

.header-actions {
  display: flex;
  gap: var(--spacing-sm);
}

/* chats: 返回是导航 chrome，不是动作，从主色改成中性次要色，把「绿色」留给页面里真正的动作链接 */
.back-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  padding: 0;
  transition: color var(--transition-fast);
}
.back-btn:hover {
  color: var(--color-text);
}

/* 注意 global.css 的 `* { font-weight: normal }` 会压掉 h1 的默认加粗，
   标题的 600 必须显式写（列表页卡片标题踩过同一个坑） */
.detail-title {
  font-size: var(--font-size-xl);
  font-weight: 600;
  margin: 0 0 var(--spacing-sm) 0;
}

.detail-meta {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-sm);
}

.detail-desc {
  color: var(--color-text-secondary);
  line-height: 1.6;
  margin: var(--spacing-sm) 0 0 0;
}

/* chats: 状态从「实心彩色药丸」改成「6px 圆点 + 中性灰文字」，
   与知识库列表页的卡片保持一致（那边也是圆点）。颜色只留在点上，
   顺带把「待学习」由红改灰——「还没开始学」不是错误状态。 */
.level-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}
.level-badge::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
.level-badge.已学会::before {
  background: var(--color-success);
}
.level-badge.学习中::before {
  background: var(--color-warning);
}
.level-badge.待学习::before {
  background: var(--status-pending);
}

.detail-date {
  font-size: var(--font-size-sm);
  color: var(--color-text-placeholder);
}

/* ===== 编辑模式 ===== */
/* chats: 详情页去彩色——这里原来有 7 个实心色块按钮（橙色「编辑」、绿色「保存」、
   绿色「添加」「上传附件」「生成思维导图」「阅读」），一屏里能同时出现三四种颜色，
   抢掉了内容本身。现在统一成一个中性描边按钮：白底 + 细边 + 深色文字，
   主次只靠文案和位置区分。要强调时把 border-color 加深一点就够，不必上色。
   按钮本体已提升到 style/global.css（.btn-outline），其它页面也能用。 */

/* chats: 就地编辑控件（标题 / 描述共用）。
   ① 只声明 font-family: inherit，字体细节一律让外层的常态类说了算 ——
      控件上同时挂着 .detail-title / .detail-desc，它们各自带着字号字重行高，
      内外都写一遍就会出现两处定义、迟早漂移。
      唯一必须显式的是 font-family：<input>/<textarea> 是表单元素，
      浏览器默认给它们 Arial，不写就会和正文不是一个字体。
   ② 淡底 + 透明边框，看起来是「一块能改的地方」，而不是凭空插进来一个输入框。
   ③ 边框只在 hover / focus 出现，光标没进去就不抢视线。
   margin 也全部不写：常态类各自带着外边距（标题的下边距、描述的上边距），
   这里再写一份就会覆盖它们，编辑态和常态的间距反而对不上。 */
.inline-field {
  box-sizing: border-box;
  display: block;
  width: 100%;
  padding: var(--spacing-xs) var(--spacing-sm);
  font-family: inherit;
  background: var(--color-bg);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  outline: none;
  resize: vertical;
  transition: all var(--transition-fast);
}
.inline-field:hover {
  background: var(--color-bg-hover);
}
.inline-field:focus {
  background: var(--color-bg-white);
  border-color: var(--color-border);
}

/* chats: 状态选择器——三个选项长得和常态的 .level-badge 完全一样（同一套圆点 + 灰字，
   圆点直接复用 .level-badge::before），选中的那个加深加底。
   换句话说它不是「一个下拉框」，而是「那个徽章本身变得能点了」。 */
.level-picker {
  display: flex;
  gap: var(--spacing-xs);
}
.level-opt {
  padding: 2px var(--spacing-sm);
  background: none;
  border: 1px solid transparent;
  border-radius: var(--radius-full);
  font-family: inherit;
  color: var(--color-text-placeholder);
  cursor: pointer;
  transition: all var(--transition-fast);
}
.level-opt:hover {
  color: var(--color-text-secondary);
}
.level-opt.active {
  color: var(--color-text);
  background: var(--color-bg);
  border-color: var(--color-border);
}

/* ===== Tab 导航 ===== */
.tab-nav {
  display: flex;
  gap: 0;
  border-bottom: 2px solid var(--color-border);
  margin-bottom: var(--spacing-sm);
}

.tab-btn {
  padding: var(--spacing-sm) var(--spacing-lg);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  font-size: var(--font-size-md);
  color: var(--color-text-secondary);
  transition: all var(--transition-fast);
  margin-bottom: -2px;
}
.tab-btn:hover {
  color: var(--color-text);
}
/* chats: 选中态由主色改成正文色——tab 也是按钮，跟其它按钮一起去掉颜色；
   选中与否靠「下划线 + 文字加深」表达，不再靠色相。 */
.tab-btn.active {
  color: var(--color-text);
  border-bottom-color: var(--color-text);
  font-weight: 500;
}

.tab-content {
  min-height: 300px;
}
/* chats: 内容离导航栏的距离只归这里管（2026-10-10 统一）——以前三个 tab
   各自为政：概览 12px（nav mb 8 + panel pt 4）、笔记靠 panel 负 margin 抵掉后
   自己加 16、资料虚线框 12 + 框内 16 叠成 28。现在 panel 统一给 16px，
   子元素一律不再自带 margin-top */
.tab-panel {
  padding: var(--spacing-md) 0 var(--spacing-xs);
}

/* ===== 笔记 tab：横向笔记条（笔记一对多，展示/编辑收进弹窗） ===== */
/* chats: 旧的负 margin 上移 hack 已删——当年是为了让横条贴死导航栏下边框，
   后来用户要求留间距，tab-panel 统一发 16px 后这套抵消失去意义 */
.notes-panel {
  display: flex;
  flex-direction: column;
}
/* 横向笔记条：条目横排、超出横滚（滚轮直滚，复用概览卡片的 onCardWheel）。
   chats: 滚动条视觉上不显眼（2026-10-10 用户要求）——display:none + 尺寸归零双保险，
   滚动能力保留（overflow-x: auto + 滚轮直滚都在） */
.note-bar {
  margin-bottom: -4px;
  display: flex;
  align-items: stretch;
  gap: var(--spacing-sm);
  overflow-x: auto;
  padding-bottom: var(--spacing-xs);
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* 旧版 Edge */
}
.note-bar::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}
/* chats: 条目卡对齐概览页 .header-card 的视觉语言（白底 + 1px 边框 +
   radius-md + 悬停主色描边加浅阴影），整个详情页的「卡片」长一个样；
   原来的 tab 页签画法（底边框高亮 + 底部通栏分隔线）随之退场 */
.bar-item {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-bg-white);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}
.bar-item:hover {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-sm);
}
/* chats: 选中态——阅读区正在展示这篇；常亮主色描边，悬停阴影不叠加 */
.bar-item.active {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-sm);
  background: var(--color-bg-hover);
}
.bi-title {
  font-size: var(--font-size-sm);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* chats: 「新建笔记」是条目卡的虚线变体——同一套白底/圆角/悬停，
   只把实线换虚线：示意「空位，可以往里加」，和卡片家族仍是一族 */
.bar-add {
  flex: 0 0 auto;
  align-self: stretch; /* 和条目卡等高，才像同排的一张卡 */
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-bg-white);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  cursor: pointer;
  white-space: nowrap;
  transition:
    border-color var(--transition-fast),
    color var(--transition-fast);
}
.bar-add:hover {
  color: var(--color-primary);
  border-color: var(--color-primary);
}

/* ===== 笔记右键菜单（Teleport 到 body） ===== */
.ctx-mask {
  position: fixed;
  inset: 0;
  z-index: 2100; /* 盖过灯箱(2000)，菜单要能在任何浮层之上 */
}
.ctx-menu {
  position: fixed;
  min-width: 150px;
  padding: 4px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
}
.ctx-item {
  display: block;
  width: 100%;
  padding: var(--spacing-xs) var(--spacing-md);
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  text-align: left;
  font-size: var(--font-size-sm);
  cursor: pointer;
}
.ctx-item:hover {
  background: var(--color-bg-hover);
  color: var(--color-primary);
}

/* chat: 概览采用「笔记优先、资料与层级次之」的纵向结构。
   min-height 让概览至少占满一屏（扣掉页头和 tab 导航的估计高度），
   剩余空间全部交给末尾的思维导图区（flex: 1），不再留白。 */
.overview-layout {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  min-height: calc(100vh - 240px);
}
/* chat: 思维导图是概览的收尾大块，撑满剩余高度 */
.overview-layout .kb-section:last-child {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.overview-layout .kb-section:last-child .mindmap-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
}
/* chats: 概览顶部两张快捷卡平分一行；原「知识笔记」标题区/「查看全部」/
   「N 份资料」统计卡已删——卡片自带字数/个数和跳转，不重复 */
.overview-cards {
  display: flex;
  gap: var(--spacing-md);
}

/* chat: 导航下的概览内容在窄屏改为单列。 */
@media (max-width: 640px) {
  .overview-cards {
    flex-direction: column;
  }
}

/* ===== 知识 ===== */
.kb-section {
  margin-bottom: var(--spacing-lg);
  padding-bottom: var(--spacing-md);
  border-bottom: 1px solid var(--color-border);
}
.kb-section:last-child {
  border-bottom: none;
}
.kb-section-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-sm);
}
.kb-title {
  font-size: var(--font-size-md);
  font-weight: 600;
  margin: 0;
}
/* chats: 笔记字数——很轻的一行元信息，别跟区块标题抢 */
.kb-count {
  color: var(--color-text-placeholder);
  font-size: var(--font-size-xs);
}

/* ===== chats: 关系 ===== */
/* chats: 左「中心锚点」+ 右「四组」两栏。两栏之间用左栏的 border-right 拉一条竖导轨，
   右侧四组看起来才是接在左边这个中心上的，而不是四个并排的盒子。
   窄屏由文件末尾的媒体查询叠成单列。 */
.rel-wrap {
  display: grid;
  /* 左栏固定 200px，右栏吃掉剩下的宽度。右栏那个 minmax(0, 1fr) 里的 0 不能省：
     写成 1fr 时列宽下限是内容宽度，卡片里的长标题会把列顶出去而不省略。 */
  grid-template-columns: 200px minmax(0, 1fr);
}
.rel-anchor {
  align-self: start;
  /* 右栏比左栏高时，让「围绕谁」这件事一直留在视野里 */
  position: sticky;
  top: var(--spacing-md);
  padding-right: var(--spacing-lg);
  border-right: 1px solid var(--color-border);
}
.ra-eyebrow {
  margin: 0 0 var(--spacing-xs) 0;
  color: var(--color-text-placeholder);
  font-size: var(--font-size-xs);
}
.ra-title {
  margin: 0 0 var(--spacing-sm) 0;
  font-size: var(--font-size-lg);
  font-weight: 600;
  line-height: 1.35;
  /* 标题可能很长，允许折行，但别把 200px 的左栏撑破 */
  overflow-wrap: anywhere;
}
.ra-total {
  margin: var(--spacing-md) 0 var(--spacing-sm) 0;
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--color-border-light);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}
.ra-total b {
  margin-right: 2px;
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: 600;
}
.ra-breakdown {
  margin: 0;
}
.ra-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--spacing-sm);
  padding: 3px 0;
  font-size: var(--font-size-sm);
}
.ra-row dt {
  color: var(--color-text-secondary);
}
.ra-row dd {
  margin: 0;
  color: var(--color-text);
}
/* 0 项压浅，与卡片上的数量徽标同一套语言 */
.ra-row dd.zero {
  color: var(--color-text-light);
}

/* 右侧四张卡。列数交给 auto-fit 自己算：宽屏 3 列、中屏 2 列、窄屏 1 列，
   不用为每个断点手写一遍列数。空轨道会被 auto-fit 折叠，剩下的卡片自动摊平宽度，
   所以只有 3 张卡的那一行不会留一个空格子。 */
.rel-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: var(--spacing-md);
  padding-left: var(--spacing-lg);
}
/* 前置知识跨满整行：它是四组里唯一有方向的，内部要放下「我依赖 / 依赖我的」两段 */
.rel-card-wide {
  grid-column: 1 / -1;
}
/* 宽卡内部那两段并排 */
.rel-cols {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--spacing-md);
}
.rel-seg {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  min-width: 0; /* 不加的话里面的长标题不会省略，而是把这半边的列顶宽 */
}
.rel-seg-head {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}
.rel-seg-title {
  font-size: var(--font-size-sm);
  font-weight: 600;
}
/* 「自动」小标：提示这段不归本页管，维护要去对方条目 */
.rel-seg-auto {
  padding: 1px 6px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  color: var(--color-text-placeholder);
  font-size: var(--font-size-xs);
}
.rel-card {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  background: var(--color-bg-white);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}
.rel-card-head {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}
/* 方向图标：交代这张卡相对当前条目在哪个方向（上游 / 平行 / 材料 / 落地），
   四张卡因此看着像同一套系统里的四个角色，而不是四个随机盒子。
   负 margin 把它和标题拉成一个语义单元——比「标题到数量徽标」那一段更紧。 */
.rel-icon {
  flex-shrink: 0;
  margin-right: calc(-1 * var(--spacing-xs));
  color: var(--color-text-placeholder);
}
.rel-title {
  font-size: var(--font-size-md);
  font-weight: 600;
  margin: 0;
}
/* 标题下的一行说明：回答「这组和那组的区别是什么」。
   前置 / 相关以前长得一样、操作也一样，就是缺这行字，用户选的时候只能猜。 */
.rel-hint {
  margin: 0;
  color: var(--color-text-placeholder);
  font-size: var(--font-size-xs);
  line-height: 1.5;
}
/* 数量徽标：0 时压成更浅的灰，「没有」和「有 3 个」不该一样抢眼 */
.rel-count {
  min-width: 20px;
  padding: 1px 7px;
  border-radius: var(--radius-full);
  background: var(--color-bg);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  text-align: center;
}
.rel-count.zero {
  color: var(--color-text-light);
}
/* 行尾的「+ 添加」：中性文字按钮，与页面其它按钮同语言（不用色块，hover 才浮出底色） */
.rel-add-trigger {
  margin-left: auto;
  padding: 2px 8px;
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}
.rel-add-trigger:hover {
  background: var(--color-bg-hover);
  color: var(--color-text);
}
.rel-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
  /* 撑住一行高度：空态那句「暂无」和标签行视觉高度一致，四张卡不会一高一矮 */
  min-height: 28px;
}
.rel-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
}
/* 对方条目标注的关系（反查出来的）：虚线框 + ↗，一眼看出「这条不是我建的」，
   点一下跳到对方条目去改——因为记录存在对方身上，在本页删了也会被反查显示回来。
   注意这里同时要重置 button 的 UA 样式（它现在是 <button> 而不是 <span>）。 */
.rel-chip-out {
  font-family: inherit;
  color: var(--color-text-secondary);
  background: none;
  border-style: dashed;
  cursor: pointer;
  text-align: left;
  transition: all var(--transition-fast);
}
.rel-chip-out:hover {
  border-color: var(--color-text-light);
  color: var(--color-text);
}
.rel-out {
  color: var(--color-text-placeholder);
  font-size: var(--font-size-xs);
}
.rel-remove {
  background: none;
  border: none;
  color: var(--color-text-placeholder);
  cursor: pointer;
  font-size: 16px;
  padding: 0 2px;
  line-height: 1;
}
.rel-remove:hover {
  color: var(--color-danger);
}
.rel-empty {
  font-size: var(--font-size-sm);
  color: var(--color-text-placeholder);
}
/* 展开的添加区：与 tags 之间一条淡线分隔；收起时这个节点整个不存在（v-if），不占高度 */
.rel-add {
  display: flex;
  gap: var(--spacing-sm);
  padding-top: var(--spacing-sm);
  border-top: 1px solid var(--color-border-light);
}
/* 下拉框/输入框统一：撑满卡片剩下的宽度（原先是写死 max-width: 320px） */
.rel-select,
.rel-input {
  flex: 1;
  min-width: 0;
  padding: 6px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  font-family: inherit;
  background: var(--color-bg-white);
}
.rel-select:focus,
.rel-input:focus {
  border-color: var(--color-primary);
  outline: none;
}
.rel-add .btn-outline {
  flex-shrink: 0;
}

/* 窄屏：左右两栏叠成一栏，导轨从竖线改横线。
   注意这条必须写在 .rel-wrap / .rel-grid 之后：媒体查询不增加优先级，同名选择器后写的赢，
   写在前面的会被上面的 200px + repeat(2, …) 覆盖掉。
   断点取 860px：右栏要放两列卡片，减掉 200px 左栏后每张卡只剩 300px 出头，再窄就开始挤。 */
@media (max-width: 860px) {
  .rel-wrap {
    grid-template-columns: minmax(0, 1fr);
  }
  .rel-anchor {
    position: static;
    padding-right: 0;
    padding-bottom: var(--spacing-md);
    margin-bottom: var(--spacing-md);
    border-right: none;
    border-bottom: 1px solid var(--color-border);
  }
  .rel-grid {
    grid-template-columns: minmax(0, 1fr);
    padding-left: 0;
  }
}

/* ===== 笔记弹窗表单（chats: 新建/修改共用，BaseModal 外壳只管遮罩和卡片）===== */
.note-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
}
/* chats: 阅读区——笔记条下方展开选中笔记的内容（2026-10-10 定稿：
   点条目在条内看，不弹窗）。卡片视觉对齐 .header-card（白底+1px 边框+radius-md） */
.note-reader {
  margin-top: var(--spacing-md);
  padding: var(--spacing-md);
  background: var(--color-bg-white);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}
.nr-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-sm);
}
.nr-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.nr-title {
  /* global.css 的 * { font-weight: normal } 会压掉默认加粗，标题必须显式写 */
  font-weight: 600;
  font-size: var(--font-size-md);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nr-date {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}
.nr-actions {
  display: flex;
  gap: var(--spacing-xs);
  flex: 0 0 auto;
}
.nr-content {
  white-space: pre-wrap; /* 保留写笔记时的回车换行 */
  line-height: 1.6;
}
.nr-placeholder {
  color: var(--color-text-placeholder);
}
.nf-field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}
.nf-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}
.nf-field input,
.nf-field textarea {
  padding: var(--spacing-sm) 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-family: inherit;
  font-size: var(--font-size-sm);
}
.nf-field textarea {
  resize: vertical;
  min-height: 140px;
  line-height: 1.8;
}
.nf-field textarea:focus,
.nf-field input:focus {
  outline: none;
  border-color: var(--color-primary);
}
.nf-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}
.nf-spacer {
  flex: 1;
}
.nf-danger:hover {
  color: var(--color-danger);
  border-color: var(--color-danger);
}

/* ===== 附件 / 资料 ===== */
.attachments-panel {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

/* chats: 原来这里是个虚线「拖拽区」盒子（padding 16 + 虚线边框）——但拖拽功能
   从来没写过，纯装饰还把按钮顶到 32px，和概览卡/笔记条的 16px 顶距对不齐。
   2026-10-10 拆掉装饰降级成普通一行 flex，按钮顶距归 tab-panel 统一发 */
.upload-area {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

/* chats: 上传触发器 + 悬停说明面板（2026-10-10 参考 UIverse tooltip 组件）——
   触发器 = 白底 + 边框 + 阴影 + 图标；面板 = absolute 下拉 + opacity/visibility 过渡。
   原上传按钮/一长条 hint 已收编进这套（.upload-btn / .upload-hint 退役） */
.upload-tip {
  position: relative;
  display: inline-block;
}
.upload-trigger {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-bg-white);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  font-size: var(--font-size-sm);
  color: var(--color-text);
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}
.upload-trigger:hover {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-md);
}
/* 面板默认隐身（opacity+visibility+上移 2px 三件），pointer-events 关掉防止
   透明时挡住下方元素的点击；悬停 wrapper 才放出 */
.upload-pop {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 20;
  width: 264px;
  margin-top: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-bg-white);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  line-height: 1.6;
  opacity: 0;
  visibility: hidden;
  transform: translateY(-2px);
  transition:
    opacity var(--transition-fast),
    transform var(--transition-fast),
    visibility var(--transition-fast);
  pointer-events: none;
}
.upload-pop p {
  margin: 0 0 4px;
}
.upload-pop p:last-child {
  margin-bottom: 0;
}
.upload-tip:hover .upload-pop {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
  pointer-events: auto;
}
.up-fmt {
  color: var(--color-text-placeholder);
}

.attachment-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.attachment-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-sm);
  background: var(--color-bg-white);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.attachment-preview {
  width: 48px;
  height: 48px;
  object-fit: cover;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.attachment-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
/* chats: 重新授权按钮——快照救不回时出现；暖色描边提示「要你点一下」而不吓人，
   align-self 防止被 column stretch 拉通栏 */
.reauth-btn {
  align-self: flex-start;
  margin-top: 2px;
  padding: 1px 8px;
  font-size: var(--font-size-xs);
  color: var(--color-warning, #b45309);
  border-color: var(--color-warning, #b45309);
}
.attachment-name {
  font-size: var(--font-size-sm);
  font-weight: 500;
}
.attachment-date {
  font-size: var(--font-size-xs);
  color: var(--color-text-placeholder);
}

/* 「阅读」按钮（只有 PDF 附件才显示），尺寸压到最小档，不抢附件本身 */
.read-btn {
  padding: 4px 12px;
  font-size: var(--font-size-xs);
  flex-shrink: 0;
}

/* 新增：非图片附件的占位图标 */
.attachment-preview.file-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg);
  color: var(--color-text-placeholder);
  font-size: var(--font-size-xs);
  font-weight: 500;
}

.delete-btn {
  background: none;
  border: none;
  font-size: 20px;
  color: var(--color-text-placeholder);
  cursor: pointer;
  padding: 0 8px;
}
.delete-btn:hover {
  color: var(--color-danger);
}

.empty-attachments {
  color: var(--color-text-placeholder);
  text-align: center;
  padding: var(--spacing-lg) 0;
}

/* ===== 思维导图 ===== */
/* chat: 去掉导图内层卡片，缩小展示高度，让它作为知识内容的辅助视图。 */
.mindmap-panel {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  /* chat: 撑满概览剩余空间；MindMap 内部自己处理平移缩放 */
  flex: 1;
  min-height: 0;
}
/* chats: 导图区域只负责「给一块确定的空间」——平移/缩放全部由 MindMap 组件内部的
   视图 transform 处理，这里不再滚动（max-content 撑宽的旧方案已随组件重写移除） */
/* chats: 导图区域只负责「给一块确定的空间」——平移/缩放全部由 MindMap 组件内部的
   视图 transform 处理。
   高度用显式 calc 而不是 flex:1 推算：思维导图页（100vh 显式高度）一直正常，
   详情页之前靠「概览 min-height → kb-section flex:1 → panel flex:1 → container flex:1」
   层层推算，任何一环推成 0 图就被 overflow:hidden 裁没（表现：不显示）。
   320 ≈ 页头 + tab 导航 + 区块边距的合计高度。 */
.mindmap-container {
  height: calc(100vh - 320px);
  min-height: 420px;
  background: transparent;
  padding: 0;
  overflow: hidden;
}
.kb-head-action:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.empty-mindmap {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-lg) 0;
  color: var(--color-text-placeholder);
  gap: var(--spacing-md);
}
</style>
