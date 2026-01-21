// pages/home/home.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    // 用户信息
    userInfo: {
      avatar: '/images/avatar.png',
      name: '未设置',
      studentId: '-',
      campus: '-',
      academy: '-',
      className: '-'
    },
    // 统计数据
    stats: [
      {
        value: '20 次',
        label: '打卡记录'
      },
      {
        value: '35 km',
        label: '累计里程'
      },
      {
        value: '15 天',
        label: '连续打卡'
      }
    ],
    // 菜单选项
    menuItems: [
      {
        id: 'edit',
        name: '个人信息',
        icon: ''
      },
      {
        id: 'awards',
        name: '我的奖项',
        icon: ''
      },
      {
        id: 'help',
        name: '帮助与反馈',
        icon: ''
      },
      {
        id: 'logout',
        name: '退出登录',
        icon: ''
      }
    ]
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {

  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  },

  /**
   * 跳转到编辑个人信息页面
   */
  navigateToUserInfo() {
    wx.navigateTo({
      url: '/pages/user-info/user-info'
    })
  },

  /**
   * 跳转到记录页面
   */
  navigateToRecord() {
    wx.switchTab({
      url: '/pages/record/record'
    })
  },

  /**
   * 菜单点击事件
   */
  handleMenuClick(e) {
    const id = e.currentTarget.dataset.id;
    switch(id) {
      case 'edit':
        // 跳转到编辑个人信息页面
        this.navigateToUserInfo();
        break;
      case 'awards':
        // 跳转到我的奖项页面
        break;
      case 'help':
        // 跳转到帮助与反馈页面
        break;
      case 'logout':
        // 退出登录逻辑
        break;
      default:
        break;
    }
  }
})