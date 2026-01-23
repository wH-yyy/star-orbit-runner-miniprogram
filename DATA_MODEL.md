# 用户数据模型规范文档

## 数据库表结构：Users

### 字段列表（共16个字段）

| 字段名 | 类型 | 说明 | 示例 |
|--------|------|------|------|
| `_id` | String | 数据库文档唯一ID（自动生成） | `507f1f77bcf86cd799439011` |
| `openid` | String | 微信OpenID（登录时自动获取） | `oQJu_5YnVYHj****` |
| `stu_id` | String | 学号（10位数字，注册时必填）| `2024010001` |
| `name` | String | 姓名 | `张三` |
| `gender` | String | 性别 | `男` / `女` |
| `campus` | String | 校区 | `兴庆校区` / `雁塔校区` / `曲江校区` / `创新港` |
| `class_name` | String | 班级 | `计算机科学与技术2024-1班` |
| `college` | String | 书院 | `仲英书院` / `文治书院` 等 |
| `phone` | String | 手机号（1[3-9]开头，11位） | `13800138000` |
| `password` | String | 密码（密文存储推荐） | `abcd1234@` |
| `createTime` | Timestamp | 创建时间（系统自动） | `2024-01-15 10:30:00` |
| `updateTime` | Timestamp | 更新时间（系统自动） | `2024-01-16 14:20:00` |
| `totalCount` | Number | 总跑步次数 | `5` |
| `totalDuration` | Number | 总跑步时长（秒） | `1800` |
| `totalDistance` | Number | 总跑步距离（米） | `5000` |

### 核心验证规则

#### 学号验证
- 格式：`/^\d{10}$/`
- 说明：10位数字
- 唯一性：必须唯一，不能重复

#### 手机号验证
- 格式：`/^1[3-9]\d{9}$/`
- 说明：以1[3-9]开头，共11位数字
- 唯一性：必须唯一，不能重复

#### 密码验证
- 格式：`/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@#$%&-_]{8,20}$/`
- 说明：必须包含字母和数字，可包含@#$%&-_，长度8-20位
- 特点：前端验证格式，后端需加密存储

#### 性别选项
- 男
- 女

#### 校区选项
- 兴庆校区
- 雁塔校区
- 曲江校区
- 创新港

#### 书院选项
- 仲英书院
- 文治书院
- 彭康书院
- 启德书院
- 励志书院
- 崇实书院
- 南洋书院
- 宗濂书院
- 厚德书院
- 钱学森书院

---

## 前端数据模型映射

### app.js 全局用户信息
```javascript
app.globalData.userInfo = {
  _id: '',              // 数据库文档ID
  openid: '',           // 微信openid
  stu_id: '',           // 学号
  name: '',             // 姓名
  gender: '',           // 性别
  campus: '',           // 校区
  class_name: '',       // 班级
  college: '',          // 书院
  phone: '',            // 手机号
  password: '',         // 密码（仅用于验证，不应在前端存储）
  totalCount: 0,        // 总跑步次数
  totalDuration: 0,     // 总跑步时长（秒）
  totalDistance: 0,     // 总跑步距离（米）
  createTime: '',       // 创建时间
  updateTime: ''        // 更新时间
}
```

### 注册页面(register)数据模型
```javascript
data: {
  phone: '',            // 手机号
  stu_id: '',           // 学号
  name: '',             // 姓名
  gender: '',           // 性别
  campusIndex: 0,       // 校区选择索引
  class_name: '',       // 班级
  collegeIndex: 0,      // 书院选择索引
  code: '',             // 验证码
  password: '',         // 密码
  confirmPassword: ''   // 确认密码
}
```

### 登录页面(login)数据模型
```javascript
data: {
  studentId: '',        // 学号（登录用）
  password: '',         // 密码
  // ...其他字段
}
```

### 用户信息页面(user-info)数据模型
```javascript
data: {
  userInfo: {
    _id: '',            // 数据库文档ID
    stu_id: '',         // 学号
    name: '',           // 姓名
    gender: '',         // 性别
    campus: '',         // 校区
    class_name: '',     // 班级
    college: '',        // 书院
    phone: '',          // 手机号
    totalCount: 0,      // 总跑步次数
    totalDuration: 0,   // 总跑步时长
    totalDistance: 0    // 总跑步距离
  }
  // ...其他状态
}
```

---

## 云函数参数规范

### Register (注册云函数)
**请求参数：**
```javascript
{
  phone: '13800138000',      // 手机号
  stu_id: '2024010001',      // 学号
  name: '张三',              // 姓名
  gender: '男',              // 性别
  campus: '兴庆校区',        // 校区
  class_name: '计科2024-1',  // 班级
  college: '仲英书院',       // 书院
  code: '123456',            // 验证码
  password: 'abcd1234@'      // 密码
}
```

### updateUserInfo (更新用户信息云函数)
**请求参数：**
```javascript
{
  _id: '507f1f77bcf86cd799439011',  // 文档ID（优先）
  stu_id: '2024010001',             // 学号（备选）
  name: '张三',                     // 可修改
  gender: '男',                     // 可修改
  campus: '兴庆校区',               // 可修改
  class_name: '计科2024-1',         // 可修改
  college: '仲英书院',              // 可修改
  phone: '13800138000',             // 可修改
  oldPassword: 'oldPass123@',       // 修改密码时需要
  newPassword: 'newPass123@'        // 修改密码时需要
}
```

### login (登录云函数)
**请求参数：**
```javascript
{
  account: '2024010001',   // 学号
  password: 'abcd1234@'    // 密码
}
```

---

## 字段命名规范说明

### 为什么使用下划线命名？
- **一致性**：所有数据库字段都采用下划线命名法（snake_case）
- **可读性**：通过下划线分隔单词，提高可读性
- **标准化**：数据库行业标准做法

### 前端vs后端字段映射
| 前端（驼峰法）| 后端/数据库（下划线法）| 说明 |
|--------------|----------------|------|
| N/A | `_id` | 仅数据库使用 |
| N/A | `openid` | 仅数据库使用 |
| `stu_id` | `stu_id` | 一致 |
| `name` | `name` | 一致 |
| `gender` | `gender` | 一致 |
| `campus` | `campus` | 一致 |
| `class_name` | `class_name` | 一致（已改） |
| `college` | `college` | 一致 |
| `phone` | `phone` | 一致 |
| N/A | `password` | 仅后端处理 |
| N/A | `createTime` | 仅数据库自动生成 |
| N/A | `updateTime` | 仅数据库自动生成 |
| `totalCount` | `totalCount` | 一致 |
| `totalDuration` | `totalDuration` | 一致 |
| `totalDistance` | `totalDistance` | 一致 |

---

## 使用指南

### 1. 获取用户信息
```javascript
const userInfo = wx.getStorageSync('userInfo')
console.log(userInfo.stu_id)      // ✓ 正确
console.log(userInfo.class_name)  // ✓ 正确
console.log(userInfo.studentId)   // ✗ 错误（已废弃）
```

### 2. 更新用户信息
```javascript
// 调用云函数时使用规范字段名
wx.cloud.callFunction({
  name: 'updateUserInfo',
  data: {
    _id: userInfo._id,
    stu_id: userInfo.stu_id,
    name: '新名字',
    class_name: '新班级'
    // ... 其他字段
  }
})
```

### 3. 全局数据访问
```javascript
const app = getApp()
const stuId = app.globalData.userInfo.stu_id  // ✓ 正确
const className = app.globalData.userInfo.class_name  // ✓ 正确
```

---

## 迁移检查清单

- [x] app.js - 全局userInfo结构更新
- [x] pages/register/register.js - 使用stu_id和class_name
- [x] pages/login/login.js - 保存规范字段
- [x] pages/user-info/user-info.js - 使用规范字段名
- [x] pages/user-info/user-info.wxml - 使用stu_id和class_name
- [x] cloudfunctions/Register/index.js - 使用规范参数
- [x] cloudfunctions/updateUserInfo/index.js - 使用规范参数

---

## 常见问题

**Q: 为什么改变了字段命名？**
A: 为了与数据库字段保持一致，减少映射关系，降低出错概率。

**Q: 是否需要迁移现有数据？**
A: 如果已有旧字段数据，需要做一次数据迁移，或在读取时做字段转换。

**Q: password字段需要加密吗？**
A: 建议使用bcrypt等算法加密存储，前端不应存储密码。

**Q: 如何处理时间戳？**
A: 使用云数据库的serverDate()方法自动生成服务端时间戳。

---

## 版本记录

| 版本 | 日期 | 说明 |
|------|------|------|
| 1.0 | 2026-01-23 | 初始版本，规范化所有数据字段 |

